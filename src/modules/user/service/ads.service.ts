import { AppDataSource } from "@config/ormconfig";
import { LocationService } from "./location.service";
import { HotelService } from "./hotel.service";
import { RestaurantService } from "./restaurant.service";
import { 
    IAdsResponseDTO, 
    ICombinedAdsResponseDTO,
    IPromotedListingsResponseDTO,
    IHotelDTO,
    IRestaurantDTO
} from "@modules/user/dtos";

export class AdsService {
    private hotelService = new HotelService();
    private restaurantService = new RestaurantService();
    private locationService = new LocationService(AppDataSource);

    async getAdsByLocation(locationId: number | number[]): Promise<IAdsResponseDTO> {
        // Expand location IDs to include descendants for recursive search
        const expandedLocationIds = await this.locationService.getDescendantIds(locationId);
        
        const [hotels, restaurants] = await Promise.all([
            this.hotelService.getHotelsByLocation(expandedLocationIds),
            this.restaurantService.getRestaurantsByLocation(expandedLocationIds),
        ]);

        return {
            hotels,
            restaurants,
        };
    }

    async getCombinedAds({
        page = 1,
        limit = 10,
        searchQuery = "",
        type = "all",
        location_id,
        rating,
        priceMax,
        isFeatured
    }: {
        page?: number;
        limit?: number;
        searchQuery?: string;
        type?: "hotel" | "restaurant" | "all";
        location_id?: number | number[];
        rating?: number;
        priceMax?: number;
        isFeatured?: boolean;
    }): Promise<ICombinedAdsResponseDTO> {
        // Expand location IDs to include descendants for recursive search
        let expandedLocationIds: number[] | undefined = undefined;
        if (location_id) {
            expandedLocationIds = await this.locationService.getDescendantIds(location_id);
        }

        // Run hotel and restaurant queries in parallel — never sequentially
        const [hotelResult, restaurantResult] = await Promise.all([
            type !== "restaurant"
                ? this.hotelService.getAllHotels({ 
                    page, limit, searchQuery, location_id: expandedLocationIds, rating, priceMax, isFeatured 
                })
                : Promise.resolve({ items: [] as IHotelDTO[], total: 0 }),
            type !== "hotel"
                ? this.restaurantService.getAllRestaurants({ 
                    page, limit, searchQuery, location_id: expandedLocationIds, rating, priceMax, isFeatured 
                })
                : Promise.resolve({ items: [] as IRestaurantDTO[], total: 0 }),
        ]);

        return {
            hotels: hotelResult.items,
            restaurants: restaurantResult.items,
            pagination: {
                page,
                limit,
                totalHotels: hotelResult.total,
                totalRestaurants: restaurantResult.total,
                totalItems: hotelResult.total + restaurantResult.total,
            },
        };
    }

    async getAdsByVendor(vendorId: string): Promise<(IHotelDTO | IRestaurantDTO)[]> {
        const [hotels, restaurants] = await Promise.all([
            this.hotelService.getAdsByVendor(vendorId),
            this.restaurantService.getAdsByVendor(vendorId),
        ]);

        // Merge and return as a single array of properties
        return [...hotels, ...restaurants];
    }

    async getPromotedListings({
        page = 1,
        limit = 10,
        searchQuery = "",
        type = "all",
        location_id,
        rating,
        priceMax,
        isFeatured,
    }: {
        page?: number;
        limit?: number;
        searchQuery?: string;
        type?: "restaurant" | "tour" | "all";
        location_id?: number | number[];
        rating?: number;
        priceMax?: number;
        isFeatured?: boolean;
    }): Promise<IPromotedListingsResponseDTO> {
        let expandedLocationIds: number[] | undefined = undefined;
        if (location_id) {
            expandedLocationIds = await this.locationService.getDescendantIds(location_id);
        }

        const restaurantResult = type !== "tour"
            ? await this.restaurantService.getAllRestaurants({
                page,
                limit,
                searchQuery,
                location_id: expandedLocationIds,
                rating,
                priceMax,
                isFeatured,
            })
            : { items: [] as IRestaurantDTO[], total: 0 };

        // Tour promoted listings are part of the intended target model, but the
        // dedicated tour listing module has not been implemented yet.
        const tours: Array<Record<string, never>> = [];
        const totalTours = 0;

        return {
            restaurants: restaurantResult.items,
            tours,
            pagination: {
                page,
                limit,
                totalRestaurants: restaurantResult.total,
                totalTours,
                totalItems: restaurantResult.total + totalTours,
            },
        };
    }
}
