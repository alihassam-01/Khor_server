import { RoomTypeEnum } from "../entity/ENUM/ad.enum";
import { SubscriptionType } from "../entity/ENUM/ad-payment.enum";

export interface IReviewDTO {
    user_name: string;
    rating: number;
    comment: string;
    date: Date;
}

export interface IRoomTypeDTO {
    type: RoomTypeEnum;
    price: number;
    amenities: string[];
    capacity: number;
}

export interface IHotelDTO {
    id: string;
    name: string;
    type: "hotel";
    rating: number;
    reviews: number;
    price: number;
    location: string;
    image: string;
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
    };
    detailed_reviews: IReviewDTO[];
    roomTypes: IRoomTypeDTO[];
    vendor_id?: string;
    expires_at?: Date;
    subscription_type?: SubscriptionType;
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
    image: string;
    description: string;
    amenities: string[];
    logo?: string | null;
    verified?: boolean;
    phone?: string | null;
    whatsapp?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    website?: string | null;
    location_id: number;
    is_active?: boolean;
    detailed_reviews?: IReviewDTO[];
    roomTypes?: IRoomTypeDTO[];
    vendor_id?: string;
    subscription_type?: SubscriptionType;
}

export interface IUpdateHotelDTO {
    name?: string;
    rating?: number;
    reviews?: number;
    price?: number;
    location_name?: string;
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
    location_id?: number;
    is_active?: boolean;
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    is_featured?: boolean;
    roomTypes?: IRoomTypeDTO[];
}
