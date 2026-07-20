import { RoomType } from "@common/enums/property.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";

export interface IReviewDTO {
    user_name: string;
    rating: number;
    comment: string;
    date: Date;
}

export interface IRoomTypeDTO {
    id?: string;
    name: string;
    description?: string;
    type?: RoomType;
    price: number;
    base_price?: number;
    discount_percentage?: number | null;
    promotion_price?: number | null;
    promotion?: IHotelPromotionSummaryDTO | null;
    amenities: string[];
    capacity: number;
    total_rooms?: number;
    bed_details?: string;
    images?: string[];
    size_sqm?: number;
    is_active?: boolean;
}

export interface IHotelPromotionSummaryDTO {
    id: string;
    name: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    applies_to: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    usage_count: number;
    savings_amount: number;
    discounted_price: number;
    percentage_off: number;
}

export interface IHotelPromotionDTO {
    id?: string;
    name: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    applies_to?: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
    usage_count?: number;
}

export interface IHotelDTO {
    id: string;
    name: string;
    type: "hotel";
    rating: number;
    reviews: number;
    price: number;
    base_price?: number;
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
        email?: string | null;
        facebook?: string | null;
        instagram?: string | null;
        website?: string | null;
        map_link?: string | null;
    };
    latitude?: number | null;
    longitude?: number | null;
    detailed_reviews: IReviewDTO[];
    roomTypes: IRoomTypeDTO[];
    promotions?: IHotelPromotionDTO[];
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
    cancellation_policy?: string | null;
    refund_cutoff_hours?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    auto_confirm_paid_bookings?: boolean;
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
    promotions?: IHotelPromotionDTO[];
    vendor_id?: string;
    subscription_type?: SubscriptionType;
    plan_id?: string;
    cancellation_policy?: string | null;
    refund_cutoff_hours?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    auto_confirm_paid_bookings?: boolean;
}

export interface IUpdateHotelDTO {
    name?: string;
    rating?: number;
    reviews?: number;
    price?: number;
    location_name?: string;
    address?: string | null;
    image?: string;
    images?: string[];
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
    promotions?: IHotelPromotionDTO[];
    cancellation_policy?: string | null;
    refund_cutoff_hours?: number | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    auto_confirm_paid_bookings?: boolean;
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
