import { PaymentStatus, PaymentMethod } from "@common/enums/payment.enums";
import { PropertyType } from "@common/enums/property.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";

export interface ICreateAdPaymentDTO {
    ad_id?: string;
    ad_type?: PropertyType;
    vendor_id: string;
    amount: number;
    payment_method?: PaymentMethod;
    transaction_id?: string;
    notes?: string;
    receipt_url?: string;
}

export interface IUpdateAdPaymentDTO {
    payment_status?: PaymentStatus;
    payment_method?: PaymentMethod;
    transaction_id?: string;
    notes?: string;
    receipt_url?: string;
}

export interface IAdPaymentDTO {
    payment_id: string;
    ad_id?: string;
    ad_type?: PropertyType;
    vendor_id: string;
    vendor_name?: string;
    vendor_email?: string;
    vendor_phone?: string;
    ad_name?: string;
    ad_location?: string;
    plan?: SubscriptionType;
    is_featured?: boolean;
    expires_at?: Date;
    amount: number;
    payment_status: PaymentStatus;
    payment_method?: PaymentMethod;
    transaction_id?: string;
    notes?: string;
    receipt_url?: string;
    created_at: Date;
    updated_at: Date;
}

export interface IRenewAdDTO {
    subscription_type: SubscriptionType;
    payment_method?: PaymentMethod;
    transaction_id?: string;
    auto_activate?: boolean;
}

export interface IToggleAdStatusDTO {
    is_active: boolean;
    reason?: string;
}

export interface ISetFeaturedDTO {
    is_featured: boolean;
    duration_days?: number;
}
