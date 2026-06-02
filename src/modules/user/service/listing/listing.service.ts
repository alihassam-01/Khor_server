import { AppDataSource } from "@config/ormconfig";
import { EntityManager, In, SelectQueryBuilder } from "typeorm";
import {
    Listing,
    ListingContact,
    ListingSubscription,
} from "@modules/user/entity/listing";
import { Location } from "@modules/user/entity/location";
import { Review } from "@modules/user/entity/review/review.entity";
import { ReviewStatus, ReviewTargetType } from "@common/enums/review.enums";
import {
    ListingMediaRole,
    ListingStatus,
    ListingType,
} from "@common/enums/listing.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { PAGINATION_DEFAULTS } from "@common/constants";
import { logError, logInfo, logWarn } from "@lib/logger";
import { isValidUuid } from "@common/utils/uuid.util";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { LocationService } from "../location.service";
import { SendEmail } from "../email/sendEmail";
import {
    IListingCreatePayload,
    IListingStrategy,
    IListingUpdatePayload,
    IListingViewModel,
} from "./listing-strategy.types";
import { ListingMediaService } from "./listing-media.service";
import { ListingSubscriptionService } from "./listing-subscription.service";

const REVIEW_PREVIEW_LIMIT = 20;

const ROLES_BY_STRATEGY: Record<ListingType, ListingMediaRole[]> = {
    [ListingType.HOTEL]: [
        ListingMediaRole.COVER,
        ListingMediaRole.LOGO,
        ListingMediaRole.GALLERY,
    ],
    [ListingType.RESTAURANT]: [
        ListingMediaRole.COVER,
        ListingMediaRole.GALLERY,
        ListingMediaRole.MENU,
    ],
    [ListingType.TOUR]: [ListingMediaRole.COVER, ListingMediaRole.GALLERY],
    [ListingType.VEHICLE]: [ListingMediaRole.COVER, ListingMediaRole.GALLERY],
};

export interface IListingQueryParams {
    page?: number;
    limit?: number;
    searchQuery?: string;
    location_id?: number | number[];
    rating?: number;
    priceMax?: number;
    isFeatured?: boolean;
    onlyActive?: boolean;
}

/**
 * Generic CRUD/query service for the unified `listings` table. Each call is
 * parameterized by a `IListingStrategy` so per-type behavior (hotel-only
 * fields, response shape) lives in a small, focused class.
 */
export class ListingService {
    private listingRepo = AppDataSource.getRepository(Listing);
    private mediaService = new ListingMediaService();
    private subscriptionService = new ListingSubscriptionService();
    private emailService = new SendEmail();

    // ---------- helpers ----------

    private async resolveVendorUserId(em: EntityManager, candidateId?: string | null): Promise<string | null> {
        if (!candidateId) return null;
        if (!isValidUuid(candidateId)) {
            logWarn(`Invalid UUID passed as vendor candidate ID: "${candidateId}". Skipping lookup.`);
            return null;
        }
        // The vendor_id column references user.id directly; just check existence
        const user = await em.getRepository("user").findOne({
            where: { id: candidateId },
            select: ["id"],
        } as any);
        return user ? candidateId : candidateId;
    }

    private async assertLocationExists(em: EntityManager, locationId: number): Promise<Location> {
        const loc = await em.getRepository(Location).findOne({
            where: { location_id: locationId },
        });
        if (!loc) {
            throw new AppError(
                `Location with id ${locationId} not found. Please select a valid location.`,
                404,
                ErrorCodes.NOT_FOUND,
            );
        }
        return loc;
    }

    private extensionRelationFor(type: ListingType): string[] {
        switch (type) {
            case ListingType.HOTEL: return ["hotel_details", "room_types", "promotions"];
            case ListingType.RESTAURANT: return ["restaurant_details"];
            default: return [];
        }
    }

    private async loadView(
        listingId: string,
        strategy: IListingStrategy<any, any, any>,
        em?: EntityManager,
    ): Promise<IListingViewModel & { location?: Location | null }> {
        const repo = em ? em.getRepository(Listing) : this.listingRepo;
        const listing = await repo.findOne({
            where: { id: listingId },
            relations: ["contact", "media", "location", "vendor", ...this.extensionRelationFor(strategy.type)],
        });
        if (!listing) {
            throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
        }

        const sub = await this.subscriptionService.getCurrent(
            em ?? AppDataSource.manager,
            listingId,
        );

        const reviewRepo = (em ?? AppDataSource.manager).getRepository(Review);
        const reviews = await reviewRepo.find({
            where: {
                target_type: ReviewTargetType.LISTING,
                target_id: listingId,
                status: ReviewStatus.PUBLISHED,
            },
            relations: ["user", "user.profile"],
            order: { created_at: "DESC" },
            take: REVIEW_PREVIEW_LIMIT,
        });

        return {
            listing,
            contact: listing.contact ?? null,
            media: listing.media ?? [],
            room_types: listing.room_types ?? [],
            promotions: listing.promotions ?? [],
            current_subscription: sub,
            reviews,
            location: listing.location ?? null,
            location_name: listing.location?.name,
        };
    }

    private async writeContact(
        em: EntityManager,
        listingId: string,
        payload: IListingCreatePayload | IListingUpdatePayload,
        isCreate: boolean,
    ): Promise<void> {
        if (!payload.contact && !isCreate) return;
        const c = payload.contact ?? {};
        const repo = em.getRepository(ListingContact);
        const existing = isCreate ? null : await repo.findOne({ where: { listing_id: listingId } });
        const row = existing ?? new ListingContact();
        row.listing_id = listingId;
        if (c.phone !== undefined) row.phone = c.phone ?? null;
        if (c.whatsapp !== undefined) row.whatsapp = c.whatsapp ?? null;
        if (c.facebook !== undefined) row.facebook = c.facebook ?? null;
        if (c.instagram !== undefined) row.instagram = c.instagram ?? null;
        if (c.website !== undefined) row.website = c.website ?? null;
        if (c.map_link !== undefined) row.map_link = c.map_link ?? null;
        if (c.address !== undefined) row.address = c.address ?? null;
        await repo.save(row);
    }

    private rolesFor(strategy: IListingStrategy<any, any, any>, mediaInputs: { role: ListingMediaRole }[]): ListingMediaRole[] {
        // Restrict the sync scope to roles that this strategy actually owns,
        // intersected with the roles present in the new payload (so an update
        // that only sends a cover doesn't wipe the gallery — but if it sends
        // both, both are replaced).
        const baseRoles = new Set(ROLES_BY_STRATEGY[strategy.type] ?? []);
        const presentRoles = new Set(mediaInputs.map((m) => m.role));
        return Array.from(baseRoles).filter((r) => presentRoles.has(r));
    }

    // ---------- create ----------

    async create<TCreate, TDTO>(
        strategy: IListingStrategy<TCreate, any, TDTO>,
        dto: TCreate,
    ): Promise<TDTO> {
        const payload = strategy.fromCreateDTO(dto);
        return AppDataSource.transaction(async (em) => {
            await this.assertLocationExists(em, payload.location_id);
            const vendorId = await this.resolveVendorUserId(em, payload.vendor_id ?? null);

            const listing = new Listing();
            listing.type = strategy.type;
            listing.name = payload.name;
            listing.description = payload.description ?? "";
            listing.price_from = Number(payload.price_from ?? 0);
            listing.location_id = payload.location_id;
            listing.vendor_id = vendorId;
            listing.amenities = payload.amenities ?? [];
            listing.latitude = payload.latitude ?? null;
            listing.longitude = payload.longitude ?? null;
            listing.is_featured = !!payload.is_featured;
            listing.is_verified = !!payload.is_verified;
            // All new listings start in PENDING/inactive — admin or vendor
            // payment activates them later.
            listing.status = ListingStatus.PENDING;
            listing.is_active = false;
            const saved = await em.getRepository(Listing).save(listing);

            // Contact + extension + media
            await this.writeContact(em, saved.id, payload, true);
            await strategy.hydrateExtension(em, saved, payload, true);
            const roles = this.rolesFor(strategy, payload.media);
            await this.mediaService.syncMedia(em, saved.id, payload.media, roles);

            // Initial subscription period (creates payment intent if non-free)
            await this.subscriptionService.openPeriod(em, saved, {
                plan_id: payload.plan_id ?? null,
                subscription_type: payload.subscription_type ?? null,
                is_featured: payload.is_featured,
            });

            const view = await this.loadView(saved.id, strategy, em);
            logInfo(`${strategy.type} created`, { id: saved.id, name: saved.name });
            return strategy.toDTO(view);
        });
    }

    // ---------- read ----------

    async findById<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        id: string,
    ): Promise<TDTO | null> {
        try {
            const view = await this.loadView(id, strategy);
            if (view.listing.type !== strategy.type) return null;
            return strategy.toDTO(view);
        } catch (err) {
            if (err instanceof AppError && err.statusCode === 404) return null;
            throw err;
        }
    }

    private applyListFilters(
        qb: SelectQueryBuilder<Listing>,
        params: IListingQueryParams & { type: ListingType },
    ): SelectQueryBuilder<Listing> {
        qb.andWhere("listing.type = :type", { type: params.type });
        if (params.onlyActive !== false) {
            qb.andWhere("listing.is_active = :active", { active: true });
        }
        if (params.searchQuery && params.searchQuery.trim() !== "") {
            qb.andWhere(
                `(listing.search_vector @@ plainto_tsquery('simple', :search) OR listing.name ILIKE :like)`,
                { search: params.searchQuery, like: `%${params.searchQuery}%` },
            );
        }
        if (params.rating != null) {
            qb.andWhere("listing.rating_avg >= :rating", { rating: params.rating });
        }
        if (params.priceMax != null) {
            qb.andWhere("listing.price_from <= :priceMax", { priceMax: params.priceMax });
        }
        if (params.isFeatured !== undefined) {
            qb.andWhere("listing.is_featured = :isFeatured", { isFeatured: params.isFeatured });
        }
        return qb;
    }

    private async expandLocations(locationId?: number | number[]): Promise<number[] | undefined> {
        if (locationId == null) return undefined;
        const locationService = new LocationService(AppDataSource);
        const expanded = await locationService.getDescendantIds(locationId);
        return expanded.length > 0 ? expanded : undefined;
    }

    async findAll<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        params: IListingQueryParams,
    ): Promise<{ items: TDTO[]; total: number; page: number; limit: number }> {
        const page = params.page ?? PAGINATION_DEFAULTS.PAGE;
        const limit = params.limit ?? PAGINATION_DEFAULTS.LIMIT;
        const skip = (page - 1) * limit;

        const expanded = await this.expandLocations(params.location_id);
        const qb = this.listingRepo.createQueryBuilder("listing")
            .leftJoinAndSelect("listing.contact", "contact")
            .leftJoinAndSelect("listing.media", "media")
            .leftJoinAndSelect("listing.location", "location");
        if (strategy.type === ListingType.HOTEL) {
            qb.leftJoinAndSelect("listing.hotel_details", "hotel_details");
            qb.leftJoinAndSelect("listing.room_types", "room_types");
            qb.leftJoinAndSelect("listing.promotions", "promotions");
        } else if (strategy.type === ListingType.RESTAURANT) {
            qb.leftJoinAndSelect("listing.restaurant_details", "restaurant_details");
        }
        qb.orderBy("listing.created_at", "DESC");

        this.applyListFilters(qb, { ...params, type: strategy.type });
        if (expanded) {
            qb.andWhere("listing.location_id IN (:...locs)", { locs: expanded });
        }

        const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();
        const subs = await this.bulkLoadSubscriptions(rows.map((r) => r.id));
        const reviews = await this.bulkLoadReviewPreviews(rows.map((r) => r.id));

        const items = rows.map((listing) => strategy.toDTO({
            listing,
            contact: listing.contact ?? null,
            media: listing.media ?? [],
            room_types: listing.room_types ?? [],
            promotions: listing.promotions ?? [],
            current_subscription: subs.get(listing.id) ?? null,
            reviews: reviews.get(listing.id) ?? [],
            location: listing.location ?? null,
            location_name: listing.location?.name,
        }));

        return { items, total, page, limit };
    }

    /** Bulk version of `subscriptionService.getCurrent` for the list endpoints. */
    private async bulkLoadSubscriptions(listingIds: string[]): Promise<Map<string, ListingSubscription>> {
        if (listingIds.length === 0) return new Map();
        const rows = await AppDataSource.getRepository(ListingSubscription)
            .createQueryBuilder("sub")
            .where("sub.listing_id IN (:...ids)", { ids: listingIds })
            .orderBy("sub.created_at", "DESC")
            .getMany();
        const out = new Map<string, ListingSubscription>();
        for (const r of rows) {
            if (!out.has(r.listing_id)) out.set(r.listing_id, r);
        }
        return out;
    }

    /** Bulk-load up to N preview reviews for each listing. */
    private async bulkLoadReviewPreviews(listingIds: string[]): Promise<Map<string, Review[]>> {
        if (listingIds.length === 0) return new Map();
        const rows = await AppDataSource.getRepository(Review).find({
            where: {
                target_type: ReviewTargetType.LISTING,
                target_id: In(listingIds),
                status: ReviewStatus.PUBLISHED,
            },
            relations: ["user", "user.profile"],
            order: { created_at: "DESC" },
        });
        const out = new Map<string, Review[]>();
        for (const r of rows) {
            const arr = out.get(r.target_id) ?? [];
            if (arr.length < REVIEW_PREVIEW_LIMIT) {
                arr.push(r);
                out.set(r.target_id, arr);
            }
        }
        return out;
    }

    async findByLocation<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        locationId: number | number[],
    ): Promise<TDTO[]> {
        const expanded = Array.isArray(locationId)
            ? locationId
            : await this.expandLocations(locationId);
        if (!expanded || expanded.length === 0) return [];
        const result = await this.findAll(strategy, {
            limit: 200, page: 1, location_id: expanded, onlyActive: true,
        });
        return result.items;
    }

    async findFeatured<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        locationId?: number,
    ): Promise<TDTO[]> {
        const result = await this.findAll(strategy, {
            limit: 200, page: 1, isFeatured: true, onlyActive: true,
            location_id: locationId,
        });
        return result.items;
    }

    async findPremium<TDTO>(strategy: IListingStrategy<any, any, TDTO>): Promise<TDTO[]> {
        const qb = this.listingRepo.createQueryBuilder("listing")
            .leftJoinAndSelect("listing.contact", "contact")
            .leftJoinAndSelect("listing.media", "media")
            .leftJoinAndSelect("listing.location", "location")
            .innerJoin(
                ListingSubscription,
                "sub",
                "sub.listing_id = listing.id AND sub.is_paid = true AND sub.subscription_type != :free",
                { free: SubscriptionType.FREE },
            );
        if (strategy.type === ListingType.HOTEL) {
            qb.leftJoinAndSelect("listing.hotel_details", "hotel_details")
                .leftJoinAndSelect("listing.room_types", "room_types")
                .leftJoinAndSelect("listing.promotions", "promotions");
        } else if (strategy.type === ListingType.RESTAURANT) {
            qb.leftJoinAndSelect("listing.restaurant_details", "restaurant_details");
        }
        qb.where("listing.type = :type", { type: strategy.type })
            .orderBy("listing.created_at", "DESC");

        const rows = await qb.getMany();
        const subs = await this.bulkLoadSubscriptions(rows.map((r) => r.id));
        const reviews = await this.bulkLoadReviewPreviews(rows.map((r) => r.id));
        return rows.map((listing) => strategy.toDTO({
            listing,
            contact: listing.contact ?? null,
            media: listing.media ?? [],
            room_types: listing.room_types ?? [],
            promotions: listing.promotions ?? [],
            current_subscription: subs.get(listing.id) ?? null,
            reviews: reviews.get(listing.id) ?? [],
            location: listing.location ?? null,
            location_name: listing.location?.name,
        }));
    }

    async findByVendor<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        vendorId: string,
    ): Promise<TDTO[]> {
        const resolved = await this.resolveVendorUserId(AppDataSource.manager, vendorId);
        if (!resolved) return [];
        const qb = this.listingRepo.createQueryBuilder("listing")
            .leftJoinAndSelect("listing.contact", "contact")
            .leftJoinAndSelect("listing.media", "media")
            .leftJoinAndSelect("listing.location", "location");
        if (strategy.type === ListingType.HOTEL) {
            qb.leftJoinAndSelect("listing.hotel_details", "hotel_details")
                .leftJoinAndSelect("listing.room_types", "room_types")
                .leftJoinAndSelect("listing.promotions", "promotions");
        } else if (strategy.type === ListingType.RESTAURANT) {
            qb.leftJoinAndSelect("listing.restaurant_details", "restaurant_details");
        }
        qb.where("listing.type = :type", { type: strategy.type })
            .andWhere("listing.vendor_id = :vendor", { vendor: resolved })
            .orderBy("listing.created_at", "DESC");

        const rows = await qb.getMany();
        const subs = await this.bulkLoadSubscriptions(rows.map((r) => r.id));
        const reviews = await this.bulkLoadReviewPreviews(rows.map((r) => r.id));
        return rows.map((listing) => strategy.toDTO({
            listing,
            contact: listing.contact ?? null,
            media: listing.media ?? [],
            room_types: listing.room_types ?? [],
            promotions: listing.promotions ?? [],
            current_subscription: subs.get(listing.id) ?? null,
            reviews: reviews.get(listing.id) ?? [],
            location: listing.location ?? null,
            location_name: listing.location?.name,
        }));
    }

    async findExpired<TDTO>(strategy: IListingStrategy<any, any, TDTO>): Promise<TDTO[]> {
        const now = new Date();
        const expiredSubs = await AppDataSource.getRepository(ListingSubscription)
            .createQueryBuilder("sub")
            .where("(sub.expires_at IS NULL OR sub.expires_at < :now)", { now })
            .getMany();
        const ids = Array.from(new Set(expiredSubs.map((s) => s.listing_id)));
        if (ids.length === 0) return [];
        const rows = await this.listingRepo.find({
            where: { id: In(ids), type: strategy.type },
            relations: ["contact", "media", "location", ...this.extensionRelationFor(strategy.type)],
            order: { created_at: "DESC" },
        });
        const subs = await this.bulkLoadSubscriptions(rows.map((r) => r.id));
        const reviews = await this.bulkLoadReviewPreviews(rows.map((r) => r.id));
        return rows.map((listing) => strategy.toDTO({
            listing,
            contact: listing.contact ?? null,
            media: listing.media ?? [],
            room_types: listing.room_types ?? [],
            promotions: listing.promotions ?? [],
            current_subscription: subs.get(listing.id) ?? null,
            reviews: reviews.get(listing.id) ?? [],
            location: listing.location ?? null,
            location_name: listing.location?.name,
        }));
    }

    // ---------- update ----------

    async update<TUpdate, TDTO>(
        strategy: IListingStrategy<any, TUpdate, TDTO>,
        id: string,
        dto: TUpdate,
    ): Promise<TDTO> {
        const payload = strategy.fromUpdateDTO(dto);

        return AppDataSource.transaction(async (em) => {
            const listing = await em.getRepository(Listing).findOne({
                where: { id },
                relations: ["contact", "media", "vendor", "vendor.profile", ...this.extensionRelationFor(strategy.type)],
            });
            if (!listing || listing.type !== strategy.type) {
                throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
            }

            const wasActive = listing.is_active;

            if (payload.name !== undefined) listing.name = payload.name;
            if (payload.description !== undefined) listing.description = payload.description;
            if (payload.price_from !== undefined) listing.price_from = Number(payload.price_from);
            if (payload.amenities !== undefined) listing.amenities = payload.amenities;
            if (payload.latitude !== undefined) listing.latitude = payload.latitude ?? null;
            if (payload.longitude !== undefined) listing.longitude = payload.longitude ?? null;
            if (payload.is_featured !== undefined) listing.is_featured = payload.is_featured;
            if (payload.is_verified !== undefined) listing.is_verified = payload.is_verified;
            if (payload.vendor_id !== undefined) {
                listing.vendor_id = await this.resolveVendorUserId(em, payload.vendor_id ?? null);
            }
            if (payload.location_id !== undefined && payload.location_id !== listing.location_id) {
                await this.assertLocationExists(em, payload.location_id);
                listing.location_id = payload.location_id;
            }
            if (payload.is_active !== undefined) {
                listing.is_active = payload.is_active;
                listing.status = payload.is_active ? ListingStatus.ACTIVE : ListingStatus.INACTIVE;
            }

            await em.getRepository(Listing).save(listing);

            // Image diff: capture old urls in the roles being replaced
            let toDelete: string[] = [];
            if (payload.media) {
                const roles = this.rolesFor(strategy, payload.media);
                if (roles.length > 0) {
                    const oldRows = (listing.media ?? []).filter((m) => roles.includes(m.role));
                    const oldUrls = new Set(oldRows.map((m) => m.url));
                    const result = await this.mediaService.syncMedia(em, listing.id, payload.media, roles);
                    toDelete = Array.from(oldUrls).filter((u) => !payload.media!.find((m) => m.url === u));
                    // Use the actual deleted set returned by syncMedia (more accurate)
                    toDelete = result.deletedUrls;
                }
            }

            await this.writeContact(em, listing.id, payload, false);
            await strategy.hydrateExtension(em, listing, payload, false);

            // Subscription / activation logic
            if (payload.is_active !== undefined && payload.is_active && !wasActive) {
                await this.subscriptionService.activate(em, listing, {
                    plan_id: payload.plan_id ?? null,
                    subscription_type: payload.subscription_type ?? null,
                });
                if (listing.vendor?.email) {
                    const sub = await this.subscriptionService.getCurrent(em, listing.id);
                    const vendorName = listing.vendor.profile?.username || "Vendor";
                    this.emailService.sendAdActivationEmail(
                        vendorName,
                        listing.vendor.email,
                        listing.name,
                        strategy.type === ListingType.HOTEL ? "Hotel" : "Restaurant",
                        sub?.expires_at ?? new Date(),
                    ).catch((e) => logError(e, `Failed activation email for ${listing.id}`));
                }
            } else if (payload.is_active === false && wasActive) {
                await this.subscriptionService.deactivate(em, listing);
            } else if (payload.plan_id !== undefined || payload.subscription_type !== undefined) {
                // Plan/type changed without activation — patch the most recent
                // subscription so future renewals use the new defaults.
                const current = await this.subscriptionService.getCurrent(em, listing.id);
                if (current) {
                    if (payload.plan_id !== undefined) current.plan_id = payload.plan_id ?? null;
                    if (payload.subscription_type !== undefined) {
                        current.subscription_type = payload.subscription_type as SubscriptionType;
                    }
                    await em.getRepository(ListingSubscription).save(current);
                }
            }

            // Schedule R2 cleanup outside the transaction
            this.mediaService.cleanupR2(toDelete).catch(() => {});

            const view = await this.loadView(listing.id, strategy, em);
            return strategy.toDTO(view);
        });
    }

    async updateByVendor<TUpdate, TDTO>(
        strategy: IListingStrategy<any, TUpdate, TDTO>,
        id: string,
        vendorId: string,
        dto: TUpdate,
    ): Promise<TDTO> {
        const resolvedVendor = await this.resolveVendorUserId(AppDataSource.manager, vendorId);
        if (!resolvedVendor) {
            throw new AppError("Unauthorized vendor", 403, ErrorCodes.FORBIDDEN);
        }

        const listing = await this.listingRepo.findOne({
            where: { id, vendor_id: resolvedVendor },
        });
        if (!listing || listing.type !== strategy.type) {
            throw new AppError(`${strategy.type} not found or access denied`, 404, ErrorCodes.NOT_FOUND);
        }

        return this.update(strategy, id, dto);
    }

    // ---------- delete ----------

    async delete(strategy: IListingStrategy<any, any, any>, id: string): Promise<void> {
        await AppDataSource.transaction(async (em) => {
            const listing = await em.getRepository(Listing).findOne({ where: { id } });
            if (!listing || listing.type !== strategy.type) {
                throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
            }
            const urls = await this.mediaService.loadAllUrls(em, listing.id);
            await em.getRepository(Listing).remove(listing);
            this.mediaService.cleanupR2(urls).catch(() => {});
        });
    }

    // ---------- admin: status / featured / renewal ----------

    async toggleStatus<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        id: string,
        isActive: boolean,
        planId?: string,
    ): Promise<TDTO> {
        return AppDataSource.transaction(async (em) => {
            const listing = await em.getRepository(Listing).findOne({
                where: { id },
                relations: ["vendor", "vendor.profile"],
            });
            if (!listing || listing.type !== strategy.type) {
                throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
            }

            const wasActive = listing.is_active;
            if (isActive) {
                await this.subscriptionService.activate(em, listing, { plan_id: planId ?? null });
            } else {
                await this.subscriptionService.deactivate(em, listing);
            }

            if (isActive && !wasActive && listing.vendor?.email) {
                const sub = await this.subscriptionService.getCurrent(em, listing.id);
                const vendorName = listing.vendor.profile?.username || "Vendor";
                this.emailService.sendAdActivationEmail(
                    vendorName,
                    listing.vendor.email,
                    listing.name,
                    strategy.type === ListingType.HOTEL ? "Hotel" : "Restaurant",
                    sub?.expires_at ?? new Date(),
                ).catch((e) => logError(e, `Failed activation email for ${listing.id}`));
            }

            const view = await this.loadView(listing.id, strategy, em);
            return strategy.toDTO(view);
        });
    }

    async setFeatured<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        id: string,
        isFeatured: boolean,
    ): Promise<TDTO> {
        const result = await this.listingRepo.update({ id, type: strategy.type }, { is_featured: isFeatured });
        if (result.affected === 0) {
            throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
        }
        const view = await this.loadView(id, strategy);
        return strategy.toDTO(view);
    }

    async renewByAdmin<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        id: string,
        opts: { subscription_type?: SubscriptionType; plan_id?: string },
    ): Promise<TDTO> {
        return AppDataSource.transaction(async (em) => {
            const listing = await em.getRepository(Listing).findOne({ where: { id } });
            if (!listing || listing.type !== strategy.type) {
                throw new AppError(`${strategy.type} not found`, 404, ErrorCodes.NOT_FOUND);
            }
            await this.subscriptionService.activate(em, listing, {
                plan_id: opts.plan_id ?? null,
                subscription_type: opts.subscription_type ?? null,
            });
            const view = await this.loadView(listing.id, strategy, em);
            return strategy.toDTO(view);
        });
    }

    async renewByVendor<TDTO>(
        strategy: IListingStrategy<any, any, TDTO>,
        id: string,
        vendorId: string,
        opts: { subscription_type?: SubscriptionType | string; plan_id?: string },
    ): Promise<TDTO> {
        return AppDataSource.transaction(async (em) => {
            const resolvedVendor = await this.resolveVendorUserId(em, vendorId);
            if (!resolvedVendor) {
                throw new AppError("Unauthorized vendor", 403, ErrorCodes.FORBIDDEN);
            }
            const listing = await em.getRepository(Listing).findOne({
                where: { id, vendor_id: resolvedVendor },
            });
            if (!listing || listing.type !== strategy.type) {
                throw new AppError(`${strategy.type} not found or access denied`, 404, ErrorCodes.NOT_FOUND);
            }

            const resolution = await this.subscriptionService.resolvePlan(em, {
                plan_id: opts.plan_id,
                subscription_type: opts.subscription_type ?? null,
                is_featured: listing.is_featured,
            });

            if (resolution.type === SubscriptionType.FREE && !listing.is_featured) {
                await this.subscriptionService.activate(em, listing, {
                    plan_id: resolution.plan?.plan_id ?? null,
                    subscription_type: resolution.type,
                    duration_days: resolution.duration_days,
                });
            } else if (resolution.total_amount <= 0) {
                await this.subscriptionService.activate(em, listing, {
                    plan_id: resolution.plan?.plan_id ?? null,
                    subscription_type: resolution.type,
                    duration_days: resolution.duration_days,
                });
            } else {
                await this.subscriptionService.openPeriod(em, listing, {
                    plan_id: resolution.plan?.plan_id ?? null,
                    subscription_type: resolution.type,
                    is_featured: listing.is_featured,
                });
            }

            const view = await this.loadView(listing.id, strategy, em);
            return strategy.toDTO(view);
        });
    }
}
