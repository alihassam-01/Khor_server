export enum BookingSource {
    CUSTOMER_WEB = "customer_web",
    PARTNER_MANUAL = "partner_manual",
}

export enum HotelBookingStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    CHECKED_IN = "checked_in",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
}

export enum BookingPaymentStatus {
    PENDING = "pending",
    AUTHORIZED = "authorized",
    PARTIALLY_PAID = "partially_paid",
    PAID = "paid",
    FAILED = "failed",
    EXPIRED = "expired",
    PARTIALLY_REFUNDED = "partially_refunded",
    REFUNDED = "refunded",
}

export enum BookingRefundStatus {
    NONE = "none",
    REQUESTED = "requested",
    APPROVED = "approved",
    PROCESSING = "processing",
    COMPLETED = "completed",
    REJECTED = "rejected",
}

export enum BookingCancellationStatus {
    NOT_REQUESTED = "not_requested",
    REQUESTED = "requested",
    APPROVED = "approved",
    REJECTED = "rejected",
    CANCELLED = "cancelled",
}

export enum BookingRefundType {
    FULL = "full",
    PARTIAL = "partial",
}

export enum BookingAuditActorRole {
    CUSTOMER = "customer",
    VENDOR = "vendor",
    ADMIN = "admin",
    SYSTEM = "system",
}

export enum BookingStatusType {
    BOOKING = "booking",
    PAYMENT = "payment",
    REFUND = "refund",
    CANCELLATION = "cancellation",
}

export enum BookingHoldStatus {
    ACTIVE = "active",
    CONSUMED = "consumed",
    RELEASED = "released",
    EXPIRED = "expired",
}
