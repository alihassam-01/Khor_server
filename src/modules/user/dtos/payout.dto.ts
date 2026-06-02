export interface ICreateBookingPayoutDTO {
    booking_id: string;
    vendor_id?: string | null;
    amount?: number;
}

export interface IUpdateBookingPayoutDTO {
    status: "pending" | "completed" | "failed";
}

export interface IBookingPayoutDTO {
    payout_id: string;
    vendor_id?: string | null;
    booking_id: string;
    amount: number;
    gross_amount?: number | null;
    commission_rate?: number | null;
    commission_amount?: number | null;
    status: "pending" | "completed" | "failed";
    payout_date?: Date | null;
    created_at: Date;
    updated_at: Date;
}
