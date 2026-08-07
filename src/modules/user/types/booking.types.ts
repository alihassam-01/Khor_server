export interface IBookingIdParams {
    id: string;
}

export interface IHotelAvailabilityParams {
    id: string;
    roomTypeId: string;
}

export interface IRoomTypeBookingParams {
    roomTypeId: string;
}

export interface IBookingHoldIdParams {
    id: string;
}

export interface IBookingListQuery {
    page?: string;
    limit?: string;
    booking_status?: string;
    listing_id?: string;
}

export interface IAvailabilityQuery {
    check_in_date: string;
    check_out_date: string;
}

export interface IBookingActionBody {
    reason?: string;
}

export interface IRefundIdParams {
    id: string;
}

export interface IRefundListQuery {
    page?: string;
    limit?: string;
    status?: string;
}

export interface IRefundProcessBody {
    provider_refund_id?: string;
    reason?: string;
}

export interface IBookingPaymentStatusParams {
    id: string;
}

export interface ISafepayReturnParams {
    result: string;
    bookingId?: string;
}
