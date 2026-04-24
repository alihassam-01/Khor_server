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

    async getAdsByLocation(locationId: number | number[]): Promise<IAdsResponseDTO> {
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
        // Run hotel and restaurant queries in parallel — never sequentially
        const [hotelResult, restaurantResult] = await Promise.all([
            type !== "restaurant"
                ? this.hotelService.getAllHotels({ page, limit, searchQuery })
                : Promise.resolve({ items: [] as IHotelDTO[], total: 0 }),
            type !== "hotel"
                ? this.restaurantService.getAllRestaurants({ page, limit, searchQuery })
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
}
