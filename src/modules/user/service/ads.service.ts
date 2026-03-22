import { HotelService } from "./hotel.service";
import { RestaurantService } from "./restaurant.service";
import { IAdsResponseDTO } from "@modules/user/dtos/ads.dto";
import { IHotelDTO } from "@modules/user/dtos/hotel.dto";
import { IRestaurantDTO } from "@modules/user/dtos/restaurant.dto";

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
    }): Promise<{
        hotels: IHotelDTO[];
        restaurants: IRestaurantDTO[];
        pagination: {
            page: number;
            limit: number;
            totalHotels: number;
            totalRestaurants: number;
            totalItems: number;
        };
    }> {
        const results = { hotels: [] as IHotelDTO[], restaurants: [] as IRestaurantDTO[], totalHotels: 0, totalRestaurants: 0 };

        if (type === "hotel" || type === "all") {
            const hotelResult = await this.hotelService.getAllHotels({
                page,
                limit,
                searchQuery,
            });
            results.hotels = (hotelResult as any).items;
            results.totalHotels = (hotelResult as any).total;
        }

        if (type === "restaurant" || type === "all") {
            const restaurantResult = await this.restaurantService.getAllRestaurants({
                page,
                limit,
                searchQuery,
            });
            results.restaurants = (restaurantResult as any).items;
            results.totalRestaurants = (restaurantResult as any).total;
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

    async getAdsByVendor(vendorId: string): Promise<any[]> {
        const [hotels, restaurants] = await Promise.all([
            this.hotelService.getAdsByVendor(vendorId),
            this.restaurantService.getAdsByVendor(vendorId),
        ]);

        // Merge and return as a single array of properties
        return [...hotels, ...restaurants];
    }
}
