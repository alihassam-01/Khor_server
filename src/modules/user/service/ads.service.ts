import { HotelService } from "./hotel.service";
import { RestaurantService } from "./restaurant.service";
import { IAdsResponseDTO } from "../dtos/ads.dto";

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
}
