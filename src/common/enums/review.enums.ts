/**
 * Moderation state of a Review. New reviews land in `pending` and become
 * visible only when an admin transitions them to `published`.
 */
export enum ReviewStatus {
    PENDING = 'pending',
    PUBLISHED = 'published',
    REJECTED = 'rejected',
    SPAM = 'spam',
}

/**
 * The kind of entity a review targets. Polymorphic: `target_id` is interpreted
 * relative to this value. UUID strings for listing/room_type, numeric strings
 * for article/location.
 */
export enum ReviewTargetType {
    LISTING = 'listing',
    ROOM_TYPE = 'room_type',
    TOUR_PACKAGE = 'tour_package',
    ARTICLE = 'article',
    LOCATION = 'location',
}
