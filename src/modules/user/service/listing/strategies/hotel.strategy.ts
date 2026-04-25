import { EntityManager } from "typeorm";
import {
    HotelDetails,
    HotelRoomType,
    Listing,
    ListingMedia,
} from "@modules/user/entity/listing";
import {
    ICreateHotelDTO,
    IHotelDTO,
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

interface IHotelExt extends Record<string, unknown> {
    verified?: boolean;
    star_rating?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    cancellation_policy?: string | null;
    roomTypes?: IRoomTypeDTO[];
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
            roomTypes: dto.roomTypes,
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
            plan_id: dto.plan_id ?? null,
            ext,
        };
    }

    fromUpdateDTO(dto: IUpdateHotelDTO): IListingUpdatePayload {
        const ext: IHotelExt = {
            verified: dto.verified,
            roomTypes: dto.roomTypes,
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
        if (dto.plan_id !== undefined) out.plan_id = dto.plan_id ?? null;

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

        if (dto.image !== undefined || dto.logo !== undefined) {
            out.media = buildMedia(dto.image, dto.logo);
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
        await detailsRepo.save(details);

        // Replace room types if provided. On create, only if provided. On update,
        // a present-but-empty array means "clear all", undefined means "no change".
        if (ext.roomTypes !== undefined) {
            await roomTypeRepo.delete({ listing_id: listing.id });
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
                    row.images = rt.images ?? [];
                    row.size_sqm = rt.size_sqm != null ? Number(rt.size_sqm) : null;
                    row.is_active = rt.is_active !== undefined ? rt.is_active : true;
                    return row;
                });
                await roomTypeRepo.save(rows);
            }
        }
    }

    toDTO(view: IListingViewModel): IHotelDTO {
        const { listing, contact, media, room_types, current_subscription, reviews, location_name } = view;
        const grouped = groupMedia(media);
        const galleryUrls = grouped.gallery.map((m) => m.url);
        const coverUrl = grouped.cover?.url ?? galleryUrls[0] ?? "";
        const allImages = coverUrl
            ? [coverUrl, ...galleryUrls.filter((u) => u !== coverUrl)]
            : galleryUrls;

        return {
            id: listing.id,
            name: listing.name,
            type: "hotel",
            rating: Number(listing.rating_avg ?? 0),
            reviews: listing.rating_count ?? 0,
            price: Number(listing.price_from ?? 0),
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
            roomTypes: (room_types ?? []).map((rt) => ({
                name: rt.name,
                description: rt.description ?? undefined,
                type: rt.type ?? undefined,
                price: Number(rt.price),
                amenities: rt.amenities ?? [],
                capacity: rt.capacity,
                total_rooms: rt.total_rooms,
                images: rt.images ?? [],
                size_sqm: rt.size_sqm != null ? Number(rt.size_sqm) : undefined,
                is_active: rt.is_active,
            })),
            vendor_id: listing.vendor_id ?? undefined,
            expires_at: current_subscription?.expires_at ?? undefined,
            subscription_type: current_subscription?.subscription_type ?? undefined,
            plan_id: current_subscription?.plan_id ?? undefined,
            is_paid: current_subscription?.is_paid ?? false,
            is_featured: listing.is_featured,
            is_active: listing.is_active,
            location_id: listing.location_id,
        };
    }
}
