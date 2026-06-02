export interface IGetAdsByLocationParams {
    location_id: string;
}

export interface IGetAdsByVendorParams {
    vendorId: string;
}

export interface IGetCombinedAdsQuery {
    page?: string;
    limit?: string;
    searchQuery?: string;
    type?: "hotel" | "restaurant" | "all";
    location_id?: string;
    rating?: string;
    priceMax?: string;
    isFeatured?: string;
}

export interface IGetPromotedListingsQuery {
    page?: string;
    limit?: string;
    searchQuery?: string;
    type?: "restaurant" | "tour" | "all";
    location_id?: string;
    rating?: string;
    priceMax?: string;
    isFeatured?: string;
}
