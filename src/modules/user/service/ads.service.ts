import { HotelService } from "./hotel.service";
import { RestaurantService } from "./restaurant.service";
import { 
    IAdsResponseDTO, 
    ICombinedAdsResponseDTO,
    IHotelDTO,
    IRestaurantDTO
} from "@modules/user/dtos";

export class AdsService {
    private hotelService = new HotelService();
    private restaurantService = new RestaurantService();

    async getAdsByLocation(locationId: number): Promise<IAdsResponseDTO> {
        const [hotels, restaurants] = await Promise.all([
            this.hotelService.getHotelsByLocation(locationId),
            this.restaurantService.getRestaurantsByLocation(locationId),
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
    }: {
        page?: number;
        limit?: number;
        searchQuery?: string;
        type?: "hotel" | "restaurant" | "all";
    }): Promise<ICombinedAdsResponseDTO> {
        const results = { 
            hotels: [] as IHotelDTO[], 
            restaurants: [] as IRestaurantDTO[], 
            totalHotels: 0, 
            totalRestaurants: 0 
        };

        if (type === "hotel" || type === "all") {
            const hotelResult = await this.hotelService.getAllHotels({
                page,
                limit,
                searchQuery,
            });
            results.hotels = hotelResult.items;
            results.totalHotels = hotelResult.total;
        }

        if (type === "restaurant" || type === "all") {
            const restaurantResult = await this.restaurantService.getAllRestaurants({
                page,
                limit,
                searchQuery,
            });
            results.restaurants = restaurantResult.items;
            results.totalRestaurants = restaurantResult.total;
        }

        return {
            hotels: results.hotels,
            restaurants: results.restaurants,
            pagination: {
                page,
                limit,
                totalHotels: results.totalHotels,
                totalRestaurants: results.totalRestaurants,
                totalItems: results.totalHotels + results.totalRestaurants,
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
}
