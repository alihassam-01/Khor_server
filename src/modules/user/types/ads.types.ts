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
}
