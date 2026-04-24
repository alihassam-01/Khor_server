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
}

export interface IRenewRestaurantAdBody {
    subscription_type: SubscriptionType;
}

export interface ISetRestaurantFeaturedStatusBody {
    is_featured: boolean;
}
