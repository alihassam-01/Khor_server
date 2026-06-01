import {
    BookingCancellationStatus,
    BookingPaymentStatus,
    BookingRefundType,
    BookingRefundStatus,
    BookingSource,
    BookingStatusType,
    HotelBookingStatus,
} from "@common/enums/booking.enums";
import { PaymentMethod } from "@common/enums/payment.enums";

export interface ICreateHotelBookingDTO {
    listing_id: string;
    room_type_id: string;
    hold_id?: string;
    rooms_count: number;
    guest_count: number;
    check_in_date: string;
    check_out_date: string;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    special_requests?: string;
    payment_amount?: number;
    payment_method?: PaymentMethod;
    payment_notes?: string;
    payment_provider?: string;
    transaction_id?: string;
}

export interface ICreateHotelBookingHoldDTO {
    listing_id: string;
    room_type_id: string;
    rooms_count: number;
    guest_count: number;
    check_in_date: string;
    check_out_date: string;
}

export interface IBookingGuestDTO {
    name: string;
    email: string;
    phone: string;
}

export interface IBookingListingSummaryDTO {
    id: string;
    name: string;
    location_id: number;
    location?: string | null;
    address?: string | null;
    image?: string | null;
    images?: string[];
    links?: {
        phone?: string | null;
        email?: string | null;
        website?: string | null;
        map_link?: string | null;
    };
    cancellation_policy?: string | null;
    refund_cutoff_hours?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
}

export interface IBookingRoomTypeSummaryDTO {
    id: string;
    name: string;
    total_rooms: number;
    capacity: number;
}

export interface IBookingPaymentSummaryDTO {
    id: string;
    amount: number;
    captured_amount: number;
    refunded_amount: number;
    currency: string;
    payment_status: BookingPaymentStatus;
    payment_method?: PaymentMethod | null;
    transaction_id?: string | null;
    notes?: string | null;
    created_at: Date;
}

export interface IBookingRefundSummaryDTO {
    id: string;
    payment_id?: string | null;
    refund_type: BookingRefundType;
    amount: number;
    status: BookingRefundStatus;
    reason?: string | null;
    provider_refund_id?: string | null;
    processed_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface IBookingTimelineActorDTO {
    user_id?: string | null;
    role?: string | null;
    name?: string | null;
    email?: string | null;
}

export interface IBookingTimelineEventDTO {
    id: string;
    entry_type: "status" | "audit";
    event_type: string;
    title: string;
    description?: string | null;
    status_type?: BookingStatusType | null;
    from_status?: string | null;
    to_status?: string | null;
    source?: string | null;
    reason?: string | null;
    actor?: IBookingTimelineActorDTO | null;
    metadata?: Record<string, unknown> | null;
    created_at: Date;
}

export interface IHotelBookingDTO {
    id: string;
    booking_number: string;
    source: BookingSource;
    customer_user_id?: string | null;
    guest: IBookingGuestDTO;
    listing: IBookingListingSummaryDTO;
    room_type: IBookingRoomTypeSummaryDTO;
    rooms_count: number;
    guest_count: number;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    currency: string;
    nightly_rate_snapshot: number;
    subtotal_amount: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    outstanding_amount: number;
    booking_status: HotelBookingStatus;
    payment_status: BookingPaymentStatus;
    cancellation_status: BookingCancellationStatus;
    refund_status: BookingRefundStatus;
    special_requests?: string | null;
    confirmed_at?: Date | null;
    cancelled_at?: Date | null;
    completed_at?: Date | null;
    created_at: Date;
    updated_at: Date;
    payments: IBookingPaymentSummaryDTO[];
    refunds: IBookingRefundSummaryDTO[];
}

export interface IHotelBookingListResponseDTO {
    items: IHotelBookingDTO[];
    total: number;
    page: number;
    limit: number;
}

export interface IHotelAvailabilityDTO {
    listing_id: string;
    room_type_id: string;
    total_rooms: number;
    reserved_rooms: number;
    held_rooms: number;
    available_rooms: number;
    check_in_date: string;
    check_out_date: string;
}

export interface IBookingHoldDTO {
    id: string;
    listing_id: string;
    room_type_id: string;
    rooms_count: number;
    guest_count: number;
    check_in_date: string;
    check_out_date: string;
    expires_at: Date;
    status: string;
    created_at: Date;
}

export interface IVendorBookingHoldDTO {
    id: string;
    listing: IBookingListingSummaryDTO;
    room_type: IBookingRoomTypeSummaryDTO;
    rooms_count: number;
    guest_count: number;
    check_in_date: string;
    check_out_date: string;
    expires_at: Date;
    status: string;
    created_at: Date;
}

export interface IRefundRequestDTO {
    booking_id: string;
    payment_id?: string;
    amount: number;
    reason?: string;
}

export interface IRecordBookingPaymentDTO {
    amount: number;
    payment_method?: PaymentMethod;
    notes?: string;
    provider?: string;
    transaction_id?: string;
    receipt_url?: string;
}

export interface IBookingRefundDTO {
    id: string;
    booking_id: string;
    booking_number: string;
    listing_id: string;
    listing_name: string;
    payment_id?: string | null;
    refund_type: BookingRefundType;
    amount: number;
    status: BookingRefundStatus;
    reason?: string | null;
    provider_refund_id?: string | null;
    requested_by_user_id?: string | null;
    approved_by_user_id?: string | null;
    processed_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface IBookingRefundListResponseDTO {
    items: IBookingRefundDTO[];
    total: number;
    page: number;
    limit: number;
}
