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
}

export interface IToggleAdStatusBody {
    is_active: boolean;
}

export interface IRenewAdBody {
    subscription_type: SubscriptionType;
}

export interface ISetFeaturedStatusBody {
    is_featured: boolean;
}
