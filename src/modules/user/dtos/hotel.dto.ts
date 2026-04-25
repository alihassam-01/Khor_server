import { RoomType } from "@common/enums/property.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IReviewDTO {
    user_name: string;
    rating: number;
    comment: string;
    date: Date;
}

export interface IRoomTypeDTO {
    name: string;
    description?: string;
    type?: RoomType;
    price: number;
    amenities: string[];
    capacity: number;
    total_rooms?: number;
    images?: string[];
    size_sqm?: number;
    is_active?: boolean;
}

export interface IHotelDTO {
    id: string;
    name: string;
    type: "hotel";
    rating: number;
    reviews: number;
    price: number;
    location: string;
    address?: string | null;
    image: string;
    images: string[];
    active: boolean;
    description: string;
    amenities: string[];
    logo: string | null;
    verified: boolean;
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
    detailed_reviews: IReviewDTO[];
    roomTypes: IRoomTypeDTO[];
    vendor_id?: string;
    expires_at?: Date;
    subscription_type?: SubscriptionType;
    plan_id?: string;
    is_paid?: boolean;
    is_featured?: boolean;
    is_active?: boolean;
    location_id?: number;
}

export interface ICreateHotelDTO {
    name: string;
    rating?: number;
    reviews?: number;
    price: number;
    location_name: string;
    address?: string | null;
    image: string;
    images?: string[];
    description: string;
    amenities: string[];
    logo?: string | null;
    verified?: boolean;
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    location_id: number;
    is_active?: boolean;
    is_featured?: boolean;
    detailed_reviews?: IReviewDTO[];
    roomTypes?: IRoomTypeDTO[];
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    plan_id?: string;
}

export interface IUpdateHotelDTO {
    name?: string;
    rating?: number;
    reviews?: number;
    price?: number;
    location_name?: string;
    address?: string | null;
    image?: string;
    description?: string;
    amenities?: string[];
    logo?: string | null;
    verified?: boolean;
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    map_link?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    location_id?: number;
    is_active?: boolean;
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    is_featured?: boolean;
    plan_id?: string;
    roomTypes?: IRoomTypeDTO[];
}

export interface IPaginatedHotelsResponse {
    items: IHotelDTO[];
    total: number;
    page: number;
    limit: number;
}

export interface IHotelStatusResponse {
    success: boolean;
    message: string;
}
