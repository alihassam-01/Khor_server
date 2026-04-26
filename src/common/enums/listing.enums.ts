/**
 * Type of a Listing. Single source of truth for the polymorphic listing model.
 * Replaces the legacy split between hotels/restaurants tables.
 */
export enum ListingType {
    HOTEL = 'hotel',
    RESTAURANT = 'restaurant',
    TOUR = 'tour',
    VEHICLE = 'vehicle',
}

/**
 * Lifecycle status of a Listing. Listings start as `pending` (awaiting admin
 * review), become `active` once approved, and may move to `inactive`/`expired`.
 * `is_active` on the Listing entity is the cached boolean form of this.
 */
export enum ListingStatus {
    DRAFT = 'draft',
    PENDING = 'pending',
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    EXPIRED = 'expired',
}

/**
 * Role of a piece of media attached to a listing.
 * - cover: the primary hero image
 * - logo: brand logo
 * - gallery: general photo gallery
 * - menu: restaurant menu page scans
 * - room: hotel room photos (linked via room_type_id when present)
 */
export enum ListingMediaRole {
    COVER = 'cover',
    LOGO = 'logo',
    GALLERY = 'gallery',
    MENU = 'menu',
    ROOM = 'room',
}

/**
 * Lifecycle of a single subscription period for a listing.
 * Multiple rows per listing represent its renewal history.
 */
export enum ListingSubscriptionStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}
