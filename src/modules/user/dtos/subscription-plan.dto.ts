import { SubscriptionType } from "@modules/user/entity/ENUM/ad-payment.enum";

export interface ISubscriptionPlanDTO {
    plan_id?: string;
    type: SubscriptionType;
    name: string;
    duration_days: number;
    price: number;
    price_per_day?: number;
    savings?: number;
    savings_percentage?: number;
    description?: string;
    features: string[];
    is_popular?: boolean;
    is_active?: boolean;
    display_order?: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface ICreateSubscriptionPlanDTO {
    type: SubscriptionType;
    name: string;
    duration_days: number;
    price: number;
    description?: string;
    features: string[];
    is_popular?: boolean;
    is_active?: boolean;
    display_order?: number;
}

export interface IUpdateSubscriptionPlanDTO {
    name?: string;
    duration_days?: number;
    price?: number;
    description?: string;
    features?: string[];
    is_popular?: boolean;
    is_active?: boolean;
    display_order?: number;
}

export interface IFeaturedPricingDTO {
    price: number;
    description: string;
}

export interface IFeaturedPricingUpdateDTO {
    price: number;
}
