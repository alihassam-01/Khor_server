import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IHotelIdParams {
    id: string;
}

export interface IHotelLocationParams {
    locationId: string;
}

export interface IVendorIdParams {
    vendorId: string;
}

export interface IGetAllHotelsQuery {
    page?: string;
    limit?: string;
    searchQuery?: string;
    location_id?: string;
    rating?: string;
    priceMax?: string;
    isFeatured?: string;
}

export interface IToggleAdStatusBody {
    is_active: boolean;
    plan_id?: string;
}

export interface IRenewAdBody {
    subscription_type?: SubscriptionType;
    plan_id?: string;
}

export interface ISetFeaturedStatusBody {
    is_featured: boolean;
}
