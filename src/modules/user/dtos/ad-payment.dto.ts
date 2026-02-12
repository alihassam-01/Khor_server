import { PaymentStatus, PaymentMethod, AdType, SubscriptionType } from "../entity/ENUM/ad-payment.enum";

export interface ICreateAdPaymentDTO {
    ad_id: string;
    ad_type: AdType;
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
    ad_id: string;
    ad_type: AdType;
    vendor_id: string;
    vendor_name?: string;
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
