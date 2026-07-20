import { EntityManager, LessThanOrEqual, MoreThan } from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { PlatformSettingsService } from "@modules/user/service/platform-settings.service";

import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";
import {
    ListingStatus,
    ListingSubscriptionStatus,
    ListingType,
} from "@common/enums/listing.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { FEATURED_AD_PRICE, SUBSCRIPTION_DURATION_DAYS } from "@common/constants";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IPlanResolution {
    type: SubscriptionType;
    duration_days: number;
    base_amount: number;
    featured_amount: number;
    total_amount: number;
}

export class VendorSubscriptionService {
    private platformSettingsService = new PlatformSettingsService();

    private parseDateInput(value?: string | Date | null): Date | null {
        if (!value) return null;
        const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private advanceCycle(
        date: Date,
        type?: SubscriptionType | string | null,
        explicitDurationDays?: number,
    ): Date {
        const next = new Date(date.getTime());
        if (explicitDurationDays && (type == null || String(type).toLowerCase() === SubscriptionType.FREE)) {
            next.setDate(next.getDate() + explicitDurationDays);
            return next;
        }
        switch (String(type ?? SubscriptionType.MONTHLY).toLowerCase()) {
            case SubscriptionType.FREE:
                next.setDate(next.getDate() + this.daysFor(type));
                return next;
            case SubscriptionType.MONTHLY:
            default:
                next.setMonth(next.getMonth() + 1);
                return next;
        }
    }

    private async setVendorListingsActive(
        em: EntityManager,
        vendorId: string,
        isActive: boolean,
    ): Promise<void> {
        const status = isActive ? ListingStatus.ACTIVE : ListingStatus.INACTIVE;
        await em.getRepository(Listing).createQueryBuilder()
            .update(Listing)
            .set({ is_active: isActive, status })
            .where("vendor_id = :vendorId", { vendorId })
            .execute();
    }

    async getCurrent(
        em: EntityManager,
        vendorId: string | null | undefined,
    ): Promise<VendorSubscription | null> {
        if (!vendorId) return null;
        return em.getRepository(VendorSubscription).findOne({
            where: { vendor_id: vendorId },
        });
    }

    daysFor(type?: SubscriptionType | string | null): number {
        if (!type) return 30;
        const key = String(type).toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        return SUBSCRIPTION_DURATION_DAYS[key] ?? 30;
    }

    async resolvePlan(
        em: EntityManager,
        vendorId: string | null | undefined,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<IPlanResolution> {
        let finalType = SubscriptionType.MONTHLY;
        let base_amount = 0;

        if (opts.subscription_type) {
            const up = String(opts.subscription_type).toUpperCase();
            if (Object.values(SubscriptionType).includes(up as any) || Object.values(SubscriptionType).includes(opts.subscription_type as any)) {
                finalType = (up === SubscriptionType.FREE.toUpperCase() ? SubscriptionType.FREE :
                             up === SubscriptionType.MONTHLY.toUpperCase() ? SubscriptionType.MONTHLY :
                             SubscriptionType.MONTHLY);
            }
        }

        const duration_days = this.daysFor(finalType);

        if (finalType !== SubscriptionType.FREE && vendorId) {
            const baseFeeStr = await this.platformSettingsService.getSetting("subscription_monthly_base_fee", "2500", em);
            const carAddonStr = await this.platformSettingsService.getSetting("subscription_car_addon_fee", "2500", em);
            const tourAddonStr = await this.platformSettingsService.getSetting("subscription_tour_addon_fee", "2500", em);

            let baseFee = Number(baseFeeStr) || 2500;
            const carAddon = Number(carAddonStr) || 2500;
            const tourAddon = Number(tourAddonStr) || 2500;

            // Find all active/pending listings for this vendor
            const listings = await em.getRepository(Listing).find({
                where: { vendor_id: vendorId, is_active: true }
            });

            const hasCar = listings.some(l => l.type === ListingType.VEHICLE);
            const hasTour = listings.some(l => l.type === ListingType.TOUR);

            if (hasCar) baseFee += carAddon;
            if (hasTour) baseFee += tourAddon;

            base_amount = baseFee;
        }

        const featuredAdPriceStr = await this.platformSettingsService.getSetting("featured_ad_price", String(FEATURED_AD_PRICE), em);
        const featured_amount = opts.is_featured ? (Number(featuredAdPriceStr) || FEATURED_AD_PRICE) : 0;
        const total_amount = base_amount + featured_amount;

        return {
            type: finalType,
            duration_days,
            base_amount,
            featured_amount,
            total_amount,
        };
    }

    async ensureForListing(
        em: EntityManager,
        listing: Listing,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;

        const existing = await this.getCurrent(em, listing.vendor_id);
        if (existing) {
            return existing;
        }

        return this.openOrRefresh(em, listing, opts, { createPaymentIntent: true });
    }

    private async openOrRefresh(
        em: EntityManager,
        listing: Listing,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
            duration_days?: number;
        },
        behavior: {
            createPaymentIntent: boolean;
            paid_at?: string | Date | null;
            next_due_date?: string | Date | null;
            forceActive?: boolean;

        } = { createPaymentIntent: false },
    ): Promise<VendorSubscription> {
        if (!listing.vendor_id) {
            throw new AppError("Listing does not belong to a vendor", 400, ErrorCodes.BAD_REQUEST);
        }

        const repo = em.getRepository(VendorSubscription);
        const current = await this.getCurrent(em, listing.vendor_id);
        const resolution = await this.resolvePlan(em, listing.vendor_id, opts);

        const sub = current ?? new VendorSubscription();
        if (!current) {
            sub.vendor_id = listing.vendor_id;

        }

        sub.subscription_type = resolution.type;
        sub.is_featured = !!opts.is_featured;
        sub.amount = resolution.total_amount;

        const paidAt = this.parseDateInput(behavior.paid_at) ?? new Date();
        const overrideDueDate = this.parseDateInput(behavior.next_due_date);
        const baseDate = this.parseDateInput(sub.next_due_date ?? sub.expires_at ?? null) ?? paidAt;
        const nextDueDate = overrideDueDate ?? this.advanceCycle(
            sub.expires_at && sub.expires_at > paidAt ? sub.expires_at : baseDate,
            resolution.type,
            opts.duration_days ?? resolution.duration_days,
        );

        const isFreeOrZero = resolution.total_amount <= 0 || (resolution.type === SubscriptionType.FREE && !opts.is_featured);
        const shouldActivate = behavior.forceActive === true || isFreeOrZero;



        if (shouldActivate) {
            sub.started_at = sub.started_at ?? paidAt;
            sub.paid_at = paidAt;
            sub.next_due_date = nextDueDate;
            sub.expires_at = nextDueDate;
            sub.status = ListingSubscriptionStatus.ACTIVE;
            sub.is_paid = true;
        } else {
            sub.status = ListingSubscriptionStatus.PENDING;
            sub.is_paid = false;
        }

        const saved = await repo.save(sub);

        

        if (shouldActivate) {
            await this.setVendorListingsActive(em, listing.vendor_id, true);
        }

        return saved;
    }

    async activate(
        em: EntityManager,
        listing: Listing,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            duration_days?: number;
        } = {},
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;
        return this.openOrRefresh(
            em,
            listing,
            {
                subscription_type: opts.subscription_type ?? null,
                is_featured: listing.is_featured,
                duration_days: opts.duration_days,
            },
            {
                createPaymentIntent: false,
                forceActive: true,
            },
        );
    }

    async openPeriod(
        em: EntityManager,
        listing: Listing,
        opts: {

            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<{ subscription: VendorSubscription | null; resolution: IPlanResolution }> {
        const resolution = await this.resolvePlan(em, listing.vendor_id, opts);
        if (!listing.vendor_id) {
            return { subscription: null, resolution };
        }

        const subscription = await this.openOrRefresh(
            em,
            listing,
            {

                subscription_type: opts.subscription_type ?? null,
                is_featured: opts.is_featured,
            },
            { createPaymentIntent: true },
        );

        return { subscription, resolution };
    }

    async deactivate(em: EntityManager, listing: Listing): Promise<void> {
        if (!listing.vendor_id) return;
        const current = await this.getCurrent(em, listing.vendor_id);
        if (current && current.status === ListingSubscriptionStatus.ACTIVE) {
            current.status = ListingSubscriptionStatus.CANCELLED;
            await em.getRepository(VendorSubscription).save(current);
        }
        await this.setVendorListingsActive(em, listing.vendor_id, false);
    }

    async markPaid(
        em: EntityManager,
        listing: Listing,
        opts: {
            paid_at?: string | Date | null;
            next_due_date?: string | Date | null;

        } = {},
    ): Promise<VendorSubscription> {
        const current = await this.getCurrent(em, listing.vendor_id!);
        return this.openOrRefresh(
            em,
            listing,
            {
                subscription_type: current?.subscription_type,
                is_featured: listing.is_featured,
            },
            {
                createPaymentIntent: false,
                paid_at: opts.paid_at,
                next_due_date: opts.next_due_date,

                forceActive: true,
            },
        );
    }

    async updateCurrentPlan(
        em: EntityManager,
        listing: Listing,
        opts: {

            subscription_type?: SubscriptionType | string | null;
        },
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;
        const current = await this.getCurrent(em, listing.vendor_id);
        if (!current) return null;

        if (opts.subscription_type !== undefined) {
            current.subscription_type = opts.subscription_type as SubscriptionType;
        }
        return em.getRepository(VendorSubscription).save(current);
    }

    async findExpiringSoon(
        em: EntityManager,
        days: number,
    ): Promise<VendorSubscription[]> {
        const now = new Date();
        const horizon = new Date(now.getTime() + days * DAY_MS);
        return em.getRepository(VendorSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: MoreThan(now),
            },
            relations: ["vendor", "vendor.profile"],
            order: { expires_at: "ASC" },
        }).then((rows) => rows.filter((row) => row.expires_at && row.expires_at <= horizon));
    }

    async findExpired(em: EntityManager): Promise<VendorSubscription[]> {
        const now = new Date();
        return em.getRepository(VendorSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: LessThanOrEqual(now),
            },
            relations: ["vendor", "vendor.profile"],
            order: { expires_at: "ASC" },
        });
    }
}


