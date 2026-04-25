/**
 * Legacy enum, kept for backward-compat in code paths (ad_payments rows on
 * disk still reference these strings). New code should prefer `ListingType`.
 *
 * Values intentionally align with `ListingType` so that conversions are a
 * no-op string equality.
 */
export enum PropertyType {
    HOTEL = 'hotel',
    RESTAURANT = 'restaurant',
    CAR_RENTAL = 'car_rental',
    TOUR = 'tour',
    VEHICLE = 'vehicle',
    ARTICLE = 'article',
    ROOM = 'room',
    OTHER = 'other',
}

export enum RoomType {
    SINGLE = 'single',
    DOUBLE = 'double',
    SUITE = 'suite',
    DELUXE = 'deluxe',
    FAMILY = 'family',
}
