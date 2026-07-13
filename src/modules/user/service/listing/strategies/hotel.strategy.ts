import { EntityManager } from "typeorm";
import {
    HotelDetails,
    HotelPromotion,
    HotelRoomType,
    Listing,
    ListingMedia,
} from "@modules/user/entity/listing";
import {
    ICreateHotelDTO,
    IHotelDTO,
    IHotelPromotionDTO,
    IRoomTypeDTO,
    IUpdateHotelDTO,
} from "@modules/user/dtos";
import {
    ListingMediaRole,
    ListingType,
} from "@common/enums/listing.enums";
import { RoomType } from "@common/enums/property.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import {
    IListingCreatePayload,
    IListingStrategy,
    IListingUpdatePayload,
    IListingViewModel,
    IMediaInput,
} from "../listing-strategy.types";
import { pickBestPromotion } from "../hotel-promotion.util";

interface IHotelExt extends Record<string, unknown> {
    verified?: boolean;
    star_rating?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    cancellation_policy?: string | null;
    refund_cutoff_hours?: number | null;
    auto_confirm_paid_bookings?: boolean;
    roomTypes?: IRoomTypeDTO[];
    promotions?: IHotelPromotionDTO[];
}

const validateRoomType = (type?: string | RoomType | null): RoomType | null => {
    if (!type) return null;
    const normalized = String(type).toLowerCase() as RoomType;
    const valid = Object.values(RoomType);
    if (!valid.includes(normalized)) {
        throw new AppError(
            `Invalid room type: "${type}". Allowed types are: ${valid.join(", ")}`,
            400,
            ErrorCodes.VALIDATION_ERROR,
        );
    }
    return normalized;
};

const buildMedia = (
    image?: string,
    logo?: string | null,
    images?: string[],
): IMediaInput[] => {
    const out: IMediaInput[] = [];
    if (image) out.push({ role: ListingMediaRole.COVER, url: image, display_order: 0 });
    if (logo) out.push({ role: ListingMediaRole.LOGO, url: logo, display_order: 0 });
    if (images && images.length > 0) {
        images.forEach((url, idx) => {
            if (url && url !== image) {
                out.push({ role: ListingMediaRole.GALLERY, url, display_order: idx });
            }
        });
    }
    return out;
};

const groupMedia = (media: ListingMedia[]) => {
    const sorted = [...media].sort(
        (a, b) => a.display_order - b.display_order || a.created_at.getTime() - b.created_at.getTime(),
    );
    const cover = sorted.find((m) => m.role === ListingMediaRole.COVER) ?? null;
    const logo = sorted.find((m) => m.role === ListingMediaRole.LOGO) ?? null;
    const gallery = sorted.filter((m) => m.role === ListingMediaRole.GALLERY);
    const menu = sorted.filter((m) => m.role === ListingMediaRole.MENU);
    const room = sorted.filter((m) => m.role === ListingMediaRole.ROOM);
    return { cover, logo, gallery, menu, room };
};

export class HotelStrategy implements IListingStrategy<ICreateHotelDTO, IUpdateHotelDTO, IHotelDTO> {
    readonly type = ListingType.HOTEL;
    readonly extensionRelations = ["hotel_details", "room_types"];

    fromCreateDTO(dto: ICreateHotelDTO): IListingCreatePayload {
        const ext: IHotelExt = {
            verified: dto.verified,
            check_in_time: dto.check_in_time ?? null,
            check_out_time: dto.check_out_time ?? null,
            cancellation_policy: dto.cancellation_policy ?? null,
            refund_cutoff_hours: dto.refund_cutoff_hours ?? null,
            auto_confirm_paid_bookings: dto.auto_confirm_paid_bookings ?? false,
            roomTypes: dto.roomTypes,
            promotions: dto.promotions,
        };
        return {
            type: ListingType.HOTEL,
            name: dto.name,
            description: dto.description,
            price_from: Number(dto.price ?? 0),
            location_id: dto.location_id,
            vendor_id: dto.vendor_id ?? null,
            amenities: dto.amenities ?? [],
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            is_featured: !!dto.is_featured,
            is_active: dto.is_active,
            is_verified: !!dto.verified,
            contact: {
                phone: dto.phone ?? null,
                whatsapp: dto.whatsapp ?? null,
                facebook: dto.facebook ?? null,
                instagram: dto.instagram ?? null,
                website: dto.website ?? null,
                map_link: dto.map_link ?? null,
                address: dto.address ?? null,
            },
            media: buildMedia(dto.image, dto.logo, dto.images),
            subscription_type: dto.subscription_type,

            ext,
        };
    }

    fromUpdateDTO(dto: IUpdateHotelDTO): IListingUpdatePayload {
        const ext: IHotelExt = {
            verified: dto.verified,
            check_in_time: dto.check_in_time,
            check_out_time: dto.check_out_time,
            cancellation_policy: dto.cancellation_policy,
            refund_cutoff_hours: dto.refund_cutoff_hours,
            auto_confirm_paid_bookings: dto.auto_confirm_paid_bookings,
            roomTypes: dto.roomTypes,
            promotions: dto.promotions,
        };
        const out: IListingUpdatePayload = { ext };
        if (dto.name !== undefined) out.name = dto.name;
        if (dto.description !== undefined) out.description = dto.description;
        if (dto.price !== undefined) out.price_from = Number(dto.price);
        if (dto.location_id !== undefined) out.location_id = dto.location_id;
        if (dto.vendor_id !== undefined) out.vendor_id = dto.vendor_id ?? null;
        if (dto.amenities !== undefined) out.amenities = dto.amenities ?? [];
        if (dto.latitude !== undefined) out.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined) out.longitude = dto.longitude ?? null;
        if (dto.is_active !== undefined) out.is_active = dto.is_active;
        if (dto.is_featured !== undefined) out.is_featured = dto.is_featured;
        if (dto.verified !== undefined) out.is_verified = !!dto.verified;
        if (dto.subscription_type !== undefined) out.subscription_type = dto.subscription_type;


        const contact: IListingUpdatePayload["contact"] = {};
        let touchedContact = false;
        if (dto.phone !== undefined) { contact.phone = dto.phone; touchedContact = true; }
        if (dto.whatsapp !== undefined) { contact.whatsapp = dto.whatsapp; touchedContact = true; }
        if (dto.facebook !== undefined) { contact.facebook = dto.facebook; touchedContact = true; }
        if (dto.instagram !== undefined) { contact.instagram = dto.instagram; touchedContact = true; }
        if (dto.website !== undefined) { contact.website = dto.website; touchedContact = true; }
        if (dto.map_link !== undefined) { contact.map_link = dto.map_link; touchedContact = true; }
        if (dto.address !== undefined) { contact.address = dto.address; touchedContact = true; }
        if (touchedContact) out.contact = contact;

        if (dto.image !== undefined || dto.logo !== undefined || dto.images !== undefined) {
            out.media = buildMedia(dto.image, dto.logo, dto.images);
        }

        return out;
    }

    async hydrateExtension(
        em: EntityManager,
        listing: Listing,
        payload: IListingCreatePayload | IListingUpdatePayload,
        isCreate: boolean,
    ): Promise<void> {
        const ext = (payload.ext as IHotelExt) || {};
        const detailsRepo = em.getRepository(HotelDetails);
        const roomTypeRepo = em.getRepository(HotelRoomType);
        const promotionRepo = em.getRepository(HotelPromotion);

        // Upsert hotel_details
        const existing = isCreate ? null : await detailsRepo.findOne({ where: { listing_id: listing.id } });
        const details = existing ?? new HotelDetails();
        details.listing_id = listing.id;
        if (ext.star_rating !== undefined) details.star_rating = ext.star_rating ?? null;
        if (ext.check_in_time !== undefined) details.check_in_time = ext.check_in_time ?? null;
        if (ext.check_out_time !== undefined) details.check_out_time = ext.check_out_time ?? null;
        if (ext.cancellation_policy !== undefined) {
            details.cancellation_policy = ext.cancellation_policy ?? null;
        }
        if (ext.refund_cutoff_hours !== undefined) {
            details.refund_cutoff_hours = ext.refund_cutoff_hours ?? null;
        }
        if (ext.auto_confirm_paid_bookings !== undefined) {
            details.auto_confirm_paid_bookings = !!ext.auto_confirm_paid_bookings;
        }
        await detailsRepo.save(details);

        // Replace room types if provided. On create, only if provided. On update,
        // undefined means "no change". On update we preserve existing rows and
        // upsert by id so location-only edits never destroy booked room types.
        if (ext.roomTypes !== undefined) {
            if (isCreate) {
                if (ext.roomTypes.length > 0) {
                    const rows = ext.roomTypes.map((rt) => {
                        const row = new HotelRoomType();
                        row.listing_id = listing.id;
                        row.name = rt.name;
                        row.description = rt.description ?? null;
                        row.type = validateRoomType(rt.type);
                        row.price = Number(rt.price);
                        row.amenities = rt.amenities ?? [];
                        row.capacity = rt.capacity;
                        row.total_rooms = rt.total_rooms ?? 1;
                        row.bed_details = rt.bed_details?.trim() || null;
                        row.images = rt.images ?? [];
                        row.size_sqm = rt.size_sqm != null ? Number(rt.size_sqm) : null;
                        row.is_active = rt.is_active !== undefined ? rt.is_active : true;
                        return row;
                    });
                    await roomTypeRepo.save(rows);
                }
            } else if (ext.roomTypes.length > 0) {
                const existingRows = await roomTypeRepo.find({ where: { listing_id: listing.id } });
                const existingById = new Map(existingRows.map((row) => [row.id, row]));

                const rows = ext.roomTypes.map((rt) => {
                    const existingRow = rt.id ? existingById.get(rt.id) : undefined;
                    const row = existingRow ?? new HotelRoomType();

                    if (existingRow && existingRow.listing_id !== listing.id) {
                        throw new AppError("Room type does not belong to this hotel", 400, ErrorCodes.VALIDATION_ERROR);
                    }

                    row.listing_id = listing.id;
                    row.name = rt.name;
                    row.description = rt.description ?? null;
                    row.type = validateRoomType(rt.type);
                    row.price = Number(rt.price);
                    row.amenities = rt.amenities ?? [];
                    row.capacity = rt.capacity;
                    row.total_rooms = rt.total_rooms ?? 1;
                    row.bed_details = rt.bed_details?.trim() || null;
                    row.images = rt.images ?? [];
                    row.size_sqm = rt.size_sqm != null ? Number(rt.size_sqm) : null;
                    row.is_active = rt.is_active !== undefined ? rt.is_active : true;
                    return row;
                });

                await roomTypeRepo.save(rows);
            }
        }

        if (ext.promotions !== undefined) {
            if (isCreate) {
                if (ext.promotions.length > 0) {
                    const rows = ext.promotions.map((promotion) => {
                        const row = new HotelPromotion();
                        row.listing_id = listing.id;
                        row.name = promotion.name.trim();
                        row.discount_type = promotion.discount_type;
                        row.discount_value = Number(promotion.discount_value);
                        row.applies_to = (promotion.applies_to ?? "all").toLowerCase();
                        row.start_date = promotion.start_date;
                        row.end_date = promotion.end_date;
                        row.is_active = promotion.is_active !== undefined ? promotion.is_active : true;
                        return row;
                    });
                    await promotionRepo.save(rows);
                }
            } else {
                const existingRows = await promotionRepo.find({ where: { listing_id: listing.id } });
                const existingById = new Map(existingRows.map((row) => [row.id, row]));
                const seenIds = new Set<string>();

                const rows = ext.promotions.map((promotion) => {
                    const existingRow = promotion.id ? existingById.get(promotion.id) : undefined;
                    const row = existingRow ?? new HotelPromotion();
                    row.listing_id = listing.id;
                    row.name = promotion.name.trim();
                    row.discount_type = promotion.discount_type;
                    row.discount_value = Number(promotion.discount_value);
                    row.applies_to = (promotion.applies_to ?? "all").toLowerCase();
                    row.start_date = promotion.start_date;
                    row.end_date = promotion.end_date;
                    row.is_active = promotion.is_active !== undefined ? promotion.is_active : true;
                    if (existingRow) {
                        seenIds.add(existingRow.id);
                    }
                    return row;
                });

                await promotionRepo.save(rows);

                const toDelete = existingRows.filter((row) => !seenIds.has(row.id) && !rows.some((item) => item.id === row.id));
                if (toDelete.length > 0) {
                    await promotionRepo.remove(toDelete);
                }
            }
        }
    }

    toDTO(view: IListingViewModel): IHotelDTO {
        const { listing, contact, media, room_types, promotions, current_subscription, reviews, location_name } = view;
        const grouped = groupMedia(media);
        const galleryUrls = grouped.gallery.map((m) => m.url);
        const coverUrl = grouped.cover?.url ?? galleryUrls[0] ?? "";
        const allImages = coverUrl
            ? [coverUrl, ...galleryUrls.filter((u) => u !== coverUrl)]
            : galleryUrls;
        const hotelPromotions = promotions ?? [];
        const roomTypes = (room_types ?? []).map((rt) => {
            const basePrice = Number(rt.price);
            const activePromotion = pickBestPromotion(basePrice, hotelPromotions, rt.type ?? null);
            return {
                id: rt.id,
                name: rt.name,
                description: rt.description ?? undefined,
                type: rt.type ?? undefined,
                price: activePromotion?.discounted_price ?? basePrice,
                base_price: basePrice,
                discount_percentage: activePromotion?.percentage_off ?? null,
                promotion_price: activePromotion?.discounted_price ?? null,
                promotion: activePromotion,
                amenities: rt.amenities ?? [],
                capacity: rt.capacity,
                total_rooms: rt.total_rooms,
                bed_details: rt.bed_details ?? undefined,
                images: rt.images ?? [],
                size_sqm: rt.size_sqm != null ? Number(rt.size_sqm) : undefined,
                is_active: rt.is_active,
            };
        });
        const minimumDisplayPrice = roomTypes.length > 0
            ? Math.min(...roomTypes.map((roomType) => Number(roomType.price ?? 0)))
            : Number(listing.price_from ?? 0);
        const minimumBasePrice = roomTypes.length > 0
            ? Math.min(...roomTypes.map((roomType) => Number(roomType.base_price ?? roomType.price ?? 0)))
            : Number(listing.price_from ?? 0);

        return {
            id: listing.id,
            name: listing.name,
            type: "hotel",
            rating: Number(listing.rating_avg ?? 0),
            reviews: listing.rating_count ?? 0,
            price: minimumDisplayPrice,
            base_price: minimumBasePrice,
            location: location_name ?? "",
            address: contact?.address ?? null,
            image: coverUrl,
            images: allImages,
            active: listing.is_active,
            description: listing.description,
            amenities: listing.amenities ?? [],
            logo: grouped.logo?.url ?? null,
            verified: listing.is_verified,
            links: {
                phone: contact?.phone ?? null,
                whatsapp: contact?.whatsapp ?? null,
                email: listing.vendor?.email ?? null,
                facebook: contact?.facebook ?? null,
                instagram: contact?.instagram ?? null,
                website: contact?.website ?? null,
                map_link: contact?.map_link ?? null,
            },
            latitude: listing.latitude != null ? Number(listing.latitude) : null,
            longitude: listing.longitude != null ? Number(listing.longitude) : null,
            detailed_reviews: reviews.map((r) => ({
                user_name: r.user?.profile?.username || r.user?.email || "User",
                rating: Number(r.rating),
                comment: r.content,
                date: r.created_at,
            })),
            roomTypes,
            promotions: hotelPromotions.map((promotion) => ({
                id: promotion.id,
                name: promotion.name,
                discount_type: promotion.discount_type,
                discount_value: Number(promotion.discount_value),
                applies_to: promotion.applies_to,
                start_date: promotion.start_date,
                end_date: promotion.end_date,
                is_active: promotion.is_active,
                usage_count: Number(promotion.usage_count ?? 0),
            })),
            vendor_id: listing.vendor_id ?? undefined,
            expires_at: current_subscription?.expires_at ?? undefined,
            paid_at: current_subscription?.paid_at ?? undefined,
            next_due_date: current_subscription?.next_due_date ?? undefined,
            grace_period_days: current_subscription?.grace_period_days ?? 7,
            subscription_type: current_subscription?.subscription_type ?? undefined,

            is_paid: current_subscription?.is_paid ?? false,
            is_featured: listing.is_featured,
            is_active: listing.is_active,
            location_id: listing.location_id,
            cancellation_policy: listing.hotel_details?.cancellation_policy ?? null,
            refund_cutoff_hours: listing.hotel_details?.refund_cutoff_hours ?? null,
            check_in_time: listing.hotel_details?.check_in_time ?? null,
            check_out_time: listing.hotel_details?.check_out_time ?? null,
            auto_confirm_paid_bookings: listing.hotel_details?.auto_confirm_paid_bookings ?? false,
        };
    }
}
