import { EntityManager } from "typeorm";
import {
    Listing,
    ListingMedia,
    RestaurantDetails,
} from "@modules/user/entity/listing";
import {
    ICreateRestaurantDTO,
    IRestaurantDTO,
    IUpdateRestaurantDTO,
} from "@modules/user/dtos";
import {
    ListingMediaRole,
    ListingType,
} from "@common/enums/listing.enums";
import {
    IListingCreatePayload,
    IListingStrategy,
    IListingUpdatePayload,
    IListingViewModel,
    IMediaInput,
} from "../listing-strategy.types";

interface IRestaurantExt extends Record<string, unknown> {
    cuisines?: string[];
    price_per_person?: number | null;
    opening_hours?: Record<string, unknown> | null;
    menu_images?: string[];
}

const buildMedia = (
    image?: string,
    images?: string[],
    menuImages?: string[],
): IMediaInput[] => {
    const out: IMediaInput[] = [];
    if (image) out.push({ role: ListingMediaRole.COVER, url: image, display_order: 0 });
    if (images && images.length > 0) {
        images.forEach((url, idx) => {
            if (url && url !== image) {
                out.push({ role: ListingMediaRole.GALLERY, url, display_order: idx });
            }
        });
    }
    if (menuImages && menuImages.length > 0) {
        menuImages.forEach((url, idx) => {
            if (url) out.push({ role: ListingMediaRole.MENU, url, display_order: idx });
        });
    }
    return out;
};

const groupMedia = (media: ListingMedia[]) => {
    const sorted = [...media].sort(
        (a, b) => a.display_order - b.display_order || a.created_at.getTime() - b.created_at.getTime(),
    );
    const cover = sorted.find((m) => m.role === ListingMediaRole.COVER) ?? null;
    const gallery = sorted.filter((m) => m.role === ListingMediaRole.GALLERY);
    const menu = sorted.filter((m) => m.role === ListingMediaRole.MENU);
    return { cover, gallery, menu };
};

export class RestaurantStrategy
    implements IListingStrategy<ICreateRestaurantDTO, IUpdateRestaurantDTO, IRestaurantDTO>
{
    readonly type = ListingType.RESTAURANT;
    readonly extensionRelations = ["restaurant_details"];

    fromCreateDTO(dto: ICreateRestaurantDTO): IListingCreatePayload {
        const ext: IRestaurantExt = {
            menu_images: dto.menu_images ?? [],
        };
        return {
            type: ListingType.RESTAURANT,
            name: dto.name,
            description: dto.description,
            price_from: Number(dto.price ?? 0),
            location_id: dto.location_id,
            vendor_id: dto.vendor_id ?? null,
            amenities: [],
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            is_featured: !!dto.is_featured,
            is_active: dto.is_active,
            is_verified: false,
            contact: {
                phone: dto.phone ?? null,
                whatsapp: dto.whatsapp ?? null,
                facebook: dto.facebook ?? null,
                instagram: dto.instagram ?? null,
                website: dto.website ?? null,
                map_link: dto.map_link ?? null,
                address: dto.address ?? null,
            },
            media: buildMedia(dto.image, dto.images, dto.menu_images),
            subscription_type: dto.subscription_type,
            plan_id: dto.plan_id ?? null,
            ext,
        };
    }

    fromUpdateDTO(dto: IUpdateRestaurantDTO): IListingUpdatePayload {
        const ext: IRestaurantExt = {};
        if (dto.menu_images !== undefined) ext.menu_images = dto.menu_images ?? [];

        const out: IListingUpdatePayload = { ext };
        if (dto.name !== undefined) out.name = dto.name;
        if (dto.description !== undefined) out.description = dto.description;
        if (dto.price !== undefined) out.price_from = Number(dto.price);
        if (dto.location_id !== undefined) out.location_id = dto.location_id;
        if (dto.vendor_id !== undefined) out.vendor_id = dto.vendor_id ?? null;
        if (dto.latitude !== undefined) out.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined) out.longitude = dto.longitude ?? null;
        if (dto.is_active !== undefined) out.is_active = dto.is_active;
        if (dto.is_featured !== undefined) out.is_featured = dto.is_featured;
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

        if (dto.image !== undefined || dto.menu_images !== undefined) {
            out.media = buildMedia(dto.image, undefined, dto.menu_images);
        }

        return out;
    }

    async hydrateExtension(
        em: EntityManager,
        listing: Listing,
        payload: IListingCreatePayload | IListingUpdatePayload,
        isCreate: boolean,
    ): Promise<void> {
        const ext = (payload.ext as IRestaurantExt) || {};
        const detailsRepo = em.getRepository(RestaurantDetails);

        const existing = isCreate ? null : await detailsRepo.findOne({ where: { listing_id: listing.id } });
        const details = existing ?? new RestaurantDetails();
        details.listing_id = listing.id;
        if (ext.cuisines !== undefined) details.cuisines = ext.cuisines ?? [];
        else if (isCreate && details.cuisines == null) details.cuisines = [];
        if (ext.price_per_person !== undefined) {
            details.price_per_person = ext.price_per_person ?? null;
        }
        if (ext.opening_hours !== undefined) {
            details.opening_hours = ext.opening_hours ?? null;
        }
        await detailsRepo.save(details);
    }

    toDTO(view: IListingViewModel): IRestaurantDTO {
        const { listing, contact, media, current_subscription, reviews, location_name } = view;
        const grouped = groupMedia(media);
        const galleryUrls = grouped.gallery.map((m) => m.url);
        const coverUrl = grouped.cover?.url ?? galleryUrls[0] ?? "";
        const allImages = coverUrl
            ? [coverUrl, ...galleryUrls.filter((u) => u !== coverUrl)]
            : galleryUrls;
        const menuUrls = grouped.menu.map((m) => m.url);

        return {
            id: listing.id,
            name: listing.name,
            type: "restaurant",
            location: location_name ?? "",
            address: contact?.address ?? null,
            price: Number(listing.price_from ?? 0),
            rating: Number(listing.rating_avg ?? 0),
            reviews: listing.rating_count ?? 0,
            image: coverUrl,
            images: allImages,
            active: listing.is_active,
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
            description: listing.description,
            menu_images: menuUrls,
            detailed_reviews: reviews.map((r) => ({
                user_name: r.user?.profile?.username || r.user?.email || "User",
                rating: Number(r.rating),
                comment: r.content,
                date: r.created_at,
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
