import { IHotelDTO } from "./hotel.dto";
import { IRestaurantDTO } from "./restaurant.dto";

export interface IAdsResponseDTO {
    hotels: IHotelDTO[];
    restaurants: IRestaurantDTO[];
}
