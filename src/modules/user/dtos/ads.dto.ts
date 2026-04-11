import { IHotelDTO } from "./hotel.dto";
import { IRestaurantDTO } from "./restaurant.dto";

export interface IAdsResponseDTO {
    hotels: IHotelDTO[];
    restaurants: IRestaurantDTO[];
}

export interface ICombinedAdsResponseDTO {
    hotels: IHotelDTO[];
    restaurants: IRestaurantDTO[];
    pagination: {
        page: number;
        limit: number;
        totalHotels: number;
        totalRestaurants: number;
        totalItems: number;
    };
}
