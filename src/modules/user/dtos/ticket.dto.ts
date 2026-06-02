import { SupportTicketStatus, SupportTicketType, UserRole } from "@common/enums";

export interface ICreateSupportTicketDTO {
    subject: string;
    message: string;
    booking_id?: string | null;
}

export interface IAddSupportTicketMessageDTO {
    message: string;
}

export interface IUpdateSupportTicketStatusDTO {
    status: SupportTicketStatus.OPEN | SupportTicketStatus.RESOLVED;
}

export interface IEscalateSupportTicketDTO {
    message?: string;
}

export interface ISupportTicketMessageDTO {
    id: string;
    message: string;
    created_at: Date;
    updated_at: Date;
    author: {
        user_id: string;
        email: string;
        role: UserRole;
        name: string;
    };
}

export interface ISupportTicketDTO {
    id: string;
    ticket_number: string;
    type: SupportTicketType;
    status: SupportTicketStatus;
    subject: string;
    customer_user_id: string;
    vendor_user_id?: string | null;
    booking_id?: string | null;
    escalated_at?: Date | null;
    resolved_at?: Date | null;
    last_activity_at: Date;
    created_at: Date;
    updated_at: Date;
    customer: {
        user_id: string;
        email: string;
        name: string;
    };
    vendor?: {
        user_id: string;
        email: string;
        name: string;
    } | null;
    booking?: {
        id: string;
        booking_number: string;
        listing_id: string;
        listing_name: string;
        room_name: string;
        check_in_date: string;
        check_out_date: string;
        total_amount: number;
        source?: string;
    } | null;
    message_count: number;
    latest_message?: ISupportTicketMessageDTO | null;
    messages?: ISupportTicketMessageDTO[];
}
