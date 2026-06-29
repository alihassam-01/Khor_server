import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IRestaurantIdParams {
    id: string;
}

export interface IGetAllRestaurantsQuery {
    page?: string;
    limit?: string;
    searchQuery?: string;
    location_id?: string;
    rating?: string;
    priceMax?: string;
    isFeatured?: string;
}

export interface IToggleRestaurantAdStatusBody {
    is_active: boolean;
    plan_id?: string;
}

export interface IRenewRestaurantAdBody {
    subscription_type?: SubscriptionType;
    plan_id?: string;
}

export interface ISetRestaurantFeaturedStatusBody {
    is_featured: boolean;
}

export interface IUpdateRestaurantSubscriptionBillingBody {
    paid_at?: string;
    next_due_date?: string;
    grace_period_days?: number;
}
