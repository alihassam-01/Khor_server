import type { EntityManager } from "typeorm";
import type {
    HotelPromotion,
    HotelRoomType,
    Listing,
    ListingContact,
    ListingMedia,
} from "@modules/user/entity/listing";
import type { ListingMediaRole, ListingType } from "@common/enums/listing.enums";
import type { Review } from "@modules/user/entity/review/review.entity";
import type { Location } from "@modules/user/entity/location";
import type { ListingSubscription } from "@modules/user/entity/listing";

/** A single piece of media to attach to a listing on create/update. */
export interface IMediaInput {
    role: ListingMediaRole;
    url: string;
    display_order?: number;
    s3_image_id?: string | null;
    room_type_id?: string | null;
    alt_text?: string | null;
}

/** Contact/external-links payload for a listing. */
export interface IContactInput {
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    address?: string | null;
}

/** Normalized create payload that any strategy understands. */
export interface IListingCreatePayload {
    type: ListingType;
    name: string;
    description: string;
    price_from: number;
    location_id: number;
    vendor_id?: string | null;
    amenities?: string[];
    latitude?: number | null;
    longitude?: number | null;
    is_featured?: boolean;
    is_active?: boolean;
    is_public_visible?: boolean;
    visibility_note?: string | null;
    is_verified?: boolean;
    contact: IContactInput;
    media: IMediaInput[];
    subscription_type?: string;
    plan_id?: string | null;
    /** Type-specific payload understood only by the matching strategy. */
    ext?: Record<string, unknown>;
}

/** Normalized update payload - every field optional. */
export interface IListingUpdatePayload {
    name?: string;
    description?: string;
    price_from?: number;
    location_id?: number;
    vendor_id?: string | null;
    amenities?: string[];
    latitude?: number | null;
    longitude?: number | null;
    is_featured?: boolean;
    is_active?: boolean;
    is_public_visible?: boolean;
    visibility_note?: string | null;
    is_verified?: boolean;
    contact?: IContactInput;
    media?: IMediaInput[];
    subscription_type?: string;
    plan_id?: string | null;
    ext?: Record<string, unknown>;
}

/** Snapshot used by `toDTO` to assemble the legacy response shape. */
export interface IListingViewModel {
    listing: Listing;
    contact: ListingContact | null;
    media: ListingMedia[];
    room_types: HotelRoomType[];
    promotions: HotelPromotion[];
    current_subscription: ListingSubscription | null;
    linked_listing?: Listing | null;
    linked_contact?: ListingContact | null;
    linked_location?: Location | null;
    linked_location_name?: string;
    linked_subscription?: ListingSubscription | null;
    reviews: Review[];
    location_name?: string;
}

/**
 * A type-specific "policy" over a Listing. Each ListingType has exactly one
 * strategy that translates the legacy DTOs (for hotel, restaurant, ...) to and
 * from the unified ListingCreatePayload, and hydrates / reads the
 * type-specific extension table.
 */
export interface IListingStrategy<
    TCreateDTO = unknown,
    TUpdateDTO = unknown,
    TResponseDTO = unknown,
> {
    readonly type: ListingType;

    /** Tables to eager-load when reading a listing of this type. */
    readonly extensionRelations: string[];

    /** Translate the legacy create DTO into a normalized payload. */
    fromCreateDTO(dto: TCreateDTO): IListingCreatePayload;

    /** Translate the legacy update DTO into a normalized payload. */
    fromUpdateDTO(dto: TUpdateDTO): IListingUpdatePayload;

    /**
     * Insert / upsert the type-specific extension row(s) (e.g. `hotel_details`,
     * `restaurant_details`, room types). Runs inside the create/update tx.
     */
    hydrateExtension(
        em: EntityManager,
        listing: Listing,
        payload: IListingCreatePayload | IListingUpdatePayload,
        isCreate: boolean,
    ): Promise<void>;

    /** Map a fully-loaded Listing to the legacy response DTO shape. */
    toDTO(view: IListingViewModel & { location?: Location | null }): TResponseDTO;
}
