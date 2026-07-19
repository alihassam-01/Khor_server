import { z } from "zod";

export const orderItemSchema = z.object({
    id: z.string().optional(), // client or server line id
    menuItemId: z.string().optional().nullable(),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
    notes: z.string().optional(),
});

export const createOnlineOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1),
    notes: z.string().optional(),
    requested_for: z.string().datetime().optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
});

export type ICreateOnlineOrderDTO = z.infer<typeof createOnlineOrderSchema>;

export const createManualOrderSchema = z.object({
    booking_id: z.string().uuid().optional(),
    items: z.array(orderItemSchema).min(1),
    notes: z.string().optional(),
    requested_for: z.string().datetime().optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
});

export type ICreateManualOrderDTO = z.infer<typeof createManualOrderSchema>;

export const updateOrderStatusSchema = z.object({
    status: z.enum(["pending", "confirmed", "cooking", "served", "cancelled"]),
});

export type IUpdateOrderStatusDTO = z.infer<typeof updateOrderStatusSchema>;

export const updateOrderSchema = z.object({
    items: z.array(orderItemSchema).optional(),
    notes: z.string().optional(),
    requested_for: z.string().datetime().optional().nullable(),
    customer_name: z.string().optional().nullable(),
    customer_phone: z.string().optional().nullable(),
});

export type IUpdateOrderDTO = z.infer<typeof updateOrderSchema>;

export interface IRestaurantOrderDTO {
    id: string;
    restaurant_id: string;
    vendor_id: string;
    booking_id?: string | null;
    guest_user_id?: string | null;
    source: "online" | "manual";
    status: "pending" | "confirmed" | "cooking" | "served" | "cancelled";
    customer_name?: string | null;
    customer_phone?: string | null;
    notes?: string | null;
    items: any[];
    total_amount: number;
    paid_amount: number;
    payment_status: "unpaid" | "partial" | "paid";
    requested_for?: string | null;
    confirmed_at?: string | null;
    served_at?: string | null;
    cancelled_at?: string | null;
    created_at: string;
    updated_at: string;
    booking_bill_item_id?: string | null;
    
    // Relations (populated conditionally)
    guest?: {
        name: string;
        email: string;
        phone?: string | null;
    };
    booking?: {
        check_in: string;
        check_out: string;
        rooms_count: number;
    };
}
