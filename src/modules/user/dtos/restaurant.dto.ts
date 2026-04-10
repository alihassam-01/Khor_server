import { IReviewDTO } from "./hotel.dto";
import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IRestaurantDTO {
    id: string;
    name: string;
    type: "restaurant";
    location: string;
    price: number;
    rating: number;
    reviews: number;
    image: string;
    images: string[];
    active: boolean;
    links: {
        phone: string | null;
        whatsapp: string | null;
        facebook?: string | null;
        instagram?: string | null;
        website?: string | null;
        map_link?: string | null;
    };
    latitude?: number | null;
    longitude?: number | null;
    description: string;
    menu_images: string[];
    detailed_reviews: IReviewDTO[];
    vendor_id?: string;
    expires_at?: Date;
    subscription_type?: SubscriptionType;
    is_paid?: boolean;
    is_featured?: boolean;
    is_active?: boolean;
    location_id?: number;
}

export interface ICreateRestaurantDTO {
    name: string;
    location_name: string;
    price: number;
    rating?: number;
    reviews?: number;
    image: string;
    images?: string[];
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description: string;
    menu_images?: string[];
    location_id: number;
    is_active?: boolean;
    is_featured?: boolean;
    detailed_reviews?: IReviewDTO[];
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    plan_id?: string;
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
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description?: string;
    menu_images?: string[];
    location_id?: number;
    is_active?: boolean;
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    is_featured?: boolean;
    plan_id?: string;
}

export interface IPaginatedRestaurantsResponse {
    items: IRestaurantDTO[];
    total: number;
    page: number;
    limit: number;
}
