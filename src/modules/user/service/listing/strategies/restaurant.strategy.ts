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
    allow_online_orders?: boolean;
    allow_table_bookings?: boolean;
    accepting_orders_now?: boolean;
    accepting_reservations_now?: boolean;
    ordering_notes?: string | null;
    reservation_notes?: string | null;
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
            cuisines: dto.cuisines ?? [],
            price_per_person: dto.price_per_person ?? null,
            opening_hours: dto.opening_hours ?? null,
            menu_images: dto.menu_images ?? [],
            allow_online_orders: dto.allow_online_orders ?? false,
            allow_table_bookings: dto.allow_table_bookings ?? false,
            accepting_orders_now: dto.accepting_orders_now ?? true,
            accepting_reservations_now: dto.accepting_reservations_now ?? true,
            ordering_notes: dto.ordering_notes ?? null,
            reservation_notes: dto.reservation_notes ?? null,
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
            is_public_visible: dto.is_public_visible,
            visibility_note: dto.visibility_note ?? null,
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
        if (dto.cuisines !== undefined) ext.cuisines = dto.cuisines ?? [];
        if (dto.price_per_person !== undefined) ext.price_per_person = dto.price_per_person ?? null;
        if (dto.opening_hours !== undefined) ext.opening_hours = dto.opening_hours ?? null;
        if (dto.menu_images !== undefined) ext.menu_images = dto.menu_images ?? [];
        if (dto.allow_online_orders !== undefined) ext.allow_online_orders = dto.allow_online_orders;
        if (dto.allow_table_bookings !== undefined) ext.allow_table_bookings = dto.allow_table_bookings;
        if (dto.accepting_orders_now !== undefined) ext.accepting_orders_now = dto.accepting_orders_now;
        if (dto.accepting_reservations_now !== undefined) ext.accepting_reservations_now = dto.accepting_reservations_now;
        if (dto.ordering_notes !== undefined) ext.ordering_notes = dto.ordering_notes ?? null;
        if (dto.reservation_notes !== undefined) ext.reservation_notes = dto.reservation_notes ?? null;

        const out: IListingUpdatePayload = { ext };
        if (dto.name !== undefined) out.name = dto.name;
        if (dto.description !== undefined) out.description = dto.description;
        if (dto.price !== undefined) out.price_from = Number(dto.price);
        if (dto.location_id !== undefined) out.location_id = dto.location_id;
        if (dto.vendor_id !== undefined) out.vendor_id = dto.vendor_id ?? null;
        if (dto.latitude !== undefined) out.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined) out.longitude = dto.longitude ?? null;
        if (dto.is_active !== undefined) out.is_active = dto.is_active;
        if (dto.is_public_visible !== undefined) out.is_public_visible = dto.is_public_visible;
        if (dto.visibility_note !== undefined) out.visibility_note = dto.visibility_note ?? null;
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

        if (dto.image !== undefined || dto.images !== undefined || dto.menu_images !== undefined) {
            out.media = buildMedia(dto.image, dto.images, dto.menu_images);
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
        if (ext.allow_online_orders !== undefined) {
            details.allow_online_orders = ext.allow_online_orders;
        } else if (isCreate) {
            details.allow_online_orders = false;
        }
        if (ext.allow_table_bookings !== undefined) {
            details.allow_table_bookings = ext.allow_table_bookings;
        } else if (isCreate) {
            details.allow_table_bookings = false;
        }
        if (ext.accepting_orders_now !== undefined) {
            details.accepting_orders_now = ext.accepting_orders_now;
        } else if (isCreate) {
            details.accepting_orders_now = true;
        }
        if (ext.accepting_reservations_now !== undefined) {
            details.accepting_reservations_now = ext.accepting_reservations_now;
        } else if (isCreate) {
            details.accepting_reservations_now = true;
        }
        if (ext.ordering_notes !== undefined) {
            details.ordering_notes = ext.ordering_notes ?? null;
        }
        if (ext.reservation_notes !== undefined) {
            details.reservation_notes = ext.reservation_notes ?? null;
        }
        await detailsRepo.save(details);
    }

    toDTO(view: IListingViewModel): IRestaurantDTO {
        const {
            listing,
            contact,
            media,
            current_subscription,
            linked_listing,
            linked_contact,
            linked_subscription,
            linked_location_name,
            reviews,
            location_name,
        } = view;
        const details = listing.restaurant_details;
        const grouped = groupMedia(media);
        const galleryUrls = grouped.gallery.map((m) => m.url);
        const coverUrl = grouped.cover?.url ?? galleryUrls[0] ?? "";
        const allImages = coverUrl
            ? [coverUrl, ...galleryUrls.filter((u) => u !== coverUrl)]
            : galleryUrls;
        const menuUrls = grouped.menu.map((m) => m.url);
        const identityListing = linked_listing ?? listing;
        const identityContact = linked_contact ?? contact;
        const subscriptionSource = linked_subscription ?? current_subscription;
        const resolvedLocationName = linked_location_name ?? location_name ?? "";

        return {
            id: listing.id,
            name: identityListing.name,
            type: "restaurant",
            location: resolvedLocationName,
            address: identityContact?.address ?? null,
            price: Number(listing.price_from ?? 0),
            rating: Number(listing.rating_avg ?? 0),
            reviews: listing.rating_count ?? 0,
            image: coverUrl,
            images: allImages,
            active: listing.is_active,
            links: {
                phone: identityContact?.phone ?? null,
                whatsapp: identityContact?.whatsapp ?? null,
                facebook: identityContact?.facebook ?? null,
                instagram: identityContact?.instagram ?? null,
                website: identityContact?.website ?? null,
                map_link: identityContact?.map_link ?? null,
            },
            latitude: identityListing.latitude != null ? Number(identityListing.latitude) : null,
            longitude: identityListing.longitude != null ? Number(identityListing.longitude) : null,
            description: listing.description,
            cuisines: details?.cuisines ?? [],
            price_per_person: details?.price_per_person != null ? Number(details.price_per_person) : null,
            opening_hours: details?.opening_hours ?? null,
            menu_images: menuUrls,
            allow_online_orders: details?.allow_online_orders ?? false,
            allow_table_bookings: details?.allow_table_bookings ?? false,
            accepting_orders_now: details?.accepting_orders_now ?? true,
            accepting_reservations_now: details?.accepting_reservations_now ?? true,
            ordering_notes: details?.ordering_notes ?? null,
            reservation_notes: details?.reservation_notes ?? null,
            is_public_visible: listing.is_public_visible,
            visibility_note: listing.visibility_note ?? null,
            detailed_reviews: reviews.map((r) => ({
                user_name: r.user?.profile?.username || r.user?.email || "User",
                rating: Number(r.rating),
                comment: r.content,
                date: r.created_at,
            })),
            vendor_id: listing.vendor_id ?? undefined,
            expires_at: subscriptionSource?.expires_at ?? undefined,
            paid_at: subscriptionSource?.paid_at ?? undefined,
            next_due_date: subscriptionSource?.next_due_date ?? undefined,
            grace_period_days: subscriptionSource?.grace_period_days ?? 7,
            subscription_type: subscriptionSource?.subscription_type ?? undefined,
            plan_id: subscriptionSource?.plan_id ?? undefined,
            is_paid: subscriptionSource?.is_paid ?? false,
            is_featured: listing.is_featured,
            is_active: listing.is_active,
            location_id: identityListing.location_id,
        };
    }
}
