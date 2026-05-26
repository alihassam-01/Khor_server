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

export interface IPromotedListingsResponseDTO {
    restaurants: IRestaurantDTO[];
    tours: Array<Record<string, never>>;
    pagination: {
        page: number;
        limit: number;
        totalRestaurants: number;
        totalTours: number;
        totalItems: number;
    };
}
