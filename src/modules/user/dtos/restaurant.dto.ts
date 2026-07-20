import { IReviewDTO } from "./hotel.dto";
import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IRestaurantDTO {
    id: string;
    name: string;
    type: "restaurant";
    location: string;
    address?: string | null;
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
    cuisines?: string[];
    price_per_person?: number | null;
    opening_hours?: Record<string, unknown> | null;
    menu_images: string[];
    allow_online_orders: boolean;
    allow_table_bookings: boolean;
    accepting_orders_now: boolean;
    accepting_reservations_now: boolean;
    ordering_notes?: string | null;
    reservation_notes?: string | null;
    is_public_visible?: boolean;
    visibility_note?: string | null;
    detailed_reviews: IReviewDTO[];
    vendor_id?: string;
    expires_at?: Date;
    paid_at?: Date;
    next_due_date?: Date;

    subscription_type?: SubscriptionType;
    subscription_status?: string;
    plan_id?: string;
    is_paid?: boolean;
    is_featured?: boolean;
    is_active?: boolean;
    location_id?: number;
}

export interface ICreateRestaurantDTO {
    name: string;
    location_name: string;
    address?: string | null;
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
    cuisines?: string[];
    price_per_person?: number | null;
    opening_hours?: Record<string, unknown> | null;
    menu_images?: string[];
    allow_online_orders?: boolean;
    allow_table_bookings?: boolean;
    accepting_orders_now?: boolean;
    accepting_reservations_now?: boolean;
    ordering_notes?: string | null;
    reservation_notes?: string | null;
    is_public_visible?: boolean;
    visibility_note?: string | null;
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
    address?: string | null;
    price?: number;
    rating?: number;
    reviews?: number;
    image?: string;
    images?: string[];
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description?: string;
    cuisines?: string[];
    price_per_person?: number | null;
    opening_hours?: Record<string, unknown> | null;
    menu_images?: string[];
    allow_online_orders?: boolean;
    allow_table_bookings?: boolean;
    accepting_orders_now?: boolean;
    accepting_reservations_now?: boolean;
    ordering_notes?: string | null;
    reservation_notes?: string | null;
    is_public_visible?: boolean;
    visibility_note?: string | null;
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
