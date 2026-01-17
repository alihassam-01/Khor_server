import { IReviewDTO } from "./hotel.dto";

export interface IRestaurantDTO {
    id: string;
    name: string;
    type: "restaurant";
    location: string;
    price: number;
    rating: number;
    reviews: number;
    image: string;
    links: {
        phone: string | null;
        whatsapp: string | null;
    };
    description: string;
    menu_images: string[];
    detailed_reviews: IReviewDTO[];
}

export interface ICreateRestaurantDTO {
    name: string;
    location_name: string;
    price: number;
    rating?: number;
    reviews?: number;
    image: string;
    phone?: string | null;
    whatsapp?: string | null;
    description: string;
    menu_images?: string[];
    location_id: number;
    is_active?: boolean;
    detailed_reviews?: IReviewDTO[];
}

export interface IUpdateRestaurantDTO {
    name?: string;
    location_name?: string;
    price?: number;
    rating?: number;
    reviews?: number;
    image?: string;
    phone?: string | null;
    whatsapp?: string | null;
    description?: string;
    menu_images?: string[];
    location_id?: number;
    is_active?: boolean;
}
