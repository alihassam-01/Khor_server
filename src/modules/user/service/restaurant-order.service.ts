import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { RestaurantOrder } from "../entity/booking/restaurant-order.entity";
import { HotelBooking } from "../entity/booking/hotel-booking.entity";
import { Listing } from "../entity/listing/listing.entity";
import { BookingBill } from "../entity/booking/booking-bill.entity";
import { BookingBillItem } from "../entity/booking/booking-bill-item.entity";
import { 
    ICreateOnlineOrderDTO, 
    ICreateManualOrderDTO, 
    IUpdateOrderStatusDTO, 
    IUpdateOrderDTO,
    IRestaurantOrderDTO 
} from "../dtos/restaurant-order.dto";
type AuthActor = {
    userId: string;
    role: string;
};

import { ListingType } from "@common/enums/listing.enums";
import { bookingRealtimeService } from "./booking-realtime.service";
import { sendEmail } from "./email";

export class RestaurantOrderService {
    private readonly orderRepo = AppDataSource.getRepository(RestaurantOrder);
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly listingRepo = AppDataSource.getRepository(Listing);

    public async createOnlineOrder(actor: AuthActor, bookingId: string, dto: ICreateOnlineOrderDTO): Promise<IRestaurantOrderDTO> {
        return AppDataSource.manager.transaction(async (manager) => {
            const booking = await manager.getRepository(HotelBooking).findOne({
                where: { id: bookingId, customer_user_id: actor.userId },
                relations: ["listing"],
            });

            if (!booking) {
                throw new AppError("Booking not found", 404, "NOT_FOUND");
            }

            // Find the linked restaurant for this vendor
            const restaurant = await manager.getRepository(Listing).findOne({
                where: {
                    vendor_id: booking.listing.vendor_id ?? undefined,
                    type: ListingType.RESTAURANT,
                },
                relations: ["restaurant_details"],
            });

            if (!restaurant) {
                throw new AppError("No restaurant available for this booking", 404, "NOT_FOUND");
            }

            if (!restaurant.restaurant_details?.allow_online_orders) {
                throw new AppError("This restaurant is not currently accepting online orders", 400, "BAD_REQUEST");
            }

            const totalAmount = dto.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // If the vendor has auto-confirm enabled, we start as confirmed, otherwise pending.
            const isAutoConfirm = restaurant.restaurant_details?.accepting_orders_now;
            const status = isAutoConfirm ? "confirmed" : "pending";

            let order = manager.getRepository(RestaurantOrder).create({
                restaurant_id: restaurant.id,
                vendor_id: restaurant.vendor_id!,
                booking_id: booking.id,
                guest_user_id: actor.userId,
                source: "online",
                status,
                customer_name: dto.customer_name || null,
                customer_phone: dto.customer_phone || null,
                notes: dto.notes || null,
                items: dto.items,
                total_amount: totalAmount,
                requested_for: dto.requested_for ? new Date(dto.requested_for) : null,
                created_by_guest_user_id: actor.userId,
            });

            if (isAutoConfirm) {
                order.confirmed_at = new Date();
                
                // create bill item immediately
                const bill = await this.getOrCreateBill(manager, booking.id);
                const billItem = manager.getRepository(BookingBillItem).create({
                    bill_id: bill.id,
                    item_name: `Restaurant Order`,
                    amount: totalAmount,
                    notes: `Online Order: ${dto.items.length} items. \n${dto.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
                    created_by_user_id: actor.userId, // System or guest
                });
                await manager.save(billItem);
                
                order.booking_bill_item_id = billItem.id;
            }

            order = await manager.save(order);

            bookingRealtimeService.publish({
                type: "restaurant_order_changed",
                action: "restaurant_order_created",
                listing_id: restaurant.id,
                vendor_id: restaurant.vendor_id!,
                booking_id: booking.id,
                customer_user_id: actor.userId,
                occurred_at: new Date().toISOString(),
            });
            
            // Load relations for DTO
            order.guest = booking.customer;
            order.booking = booking;

            return this.toDTO(order);
        });
    }

    public async createManualOrder(actor: AuthActor, dto: ICreateManualOrderDTO): Promise<IRestaurantOrderDTO> {
        return AppDataSource.manager.transaction(async (manager) => {
            const restaurant = await manager.getRepository(Listing).findOne({
                where: { vendor_id: actor.userId, type: ListingType.RESTAURANT },
            });

            if (!restaurant) {
                throw new AppError("Vendor has no active restaurant", 404, "NOT_FOUND");
            }

            let booking = null;
            if (dto.booking_id) {
                booking = await manager.getRepository(HotelBooking).findOne({
                    where: { id: dto.booking_id },
                    relations: ["listing"],
                });
                if (!booking) throw new AppError("Booking not found", 404, "NOT_FOUND");
                if (booking.listing.vendor_id !== actor.userId) throw new AppError("Unauthorized for this booking", 403, "FORBIDDEN");
            }

            const totalAmount = dto.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const order = manager.getRepository(RestaurantOrder).create({
                restaurant_id: restaurant.id,
                vendor_id: restaurant.vendor_id!,
                booking_id: dto.booking_id || null,
                guest_user_id: booking?.customer_user_id || null,
                source: "manual",
                status: "pending",
                customer_name: dto.customer_name || null,
                customer_phone: dto.customer_phone || null,
                notes: dto.notes || null,
                items: dto.items,
                total_amount: totalAmount,
                requested_for: dto.requested_for ? new Date(dto.requested_for) : null,
                created_by_vendor_user_id: actor.userId,
            });

            await manager.save(order);
            return this.toDTO(order);
        });
    }

    public async listGuestOrders(actor: AuthActor, bookingId: string): Promise<IRestaurantOrderDTO[]> {
        const orders = await this.orderRepo.find({
            where: { booking_id: bookingId, guest_user_id: actor.userId },
            relations: ["guest", "guest.profile", "booking"],
            order: { created_at: "DESC" },
        });

        return orders.map(o => this.toDTO(o));
    }

    public async listVendorOrders(actor: AuthActor): Promise<IRestaurantOrderDTO[]> {
        const orders = await this.orderRepo.find({
            where: { vendor_id: actor.userId },
            relations: ["guest", "guest.profile", "booking"],
            order: { created_at: "DESC" },
        });

        return orders.map(o => this.toDTO(o));
    }

    public async getRestaurantOrderingContext(actor: AuthActor, bookingId: string): Promise<any> {
        const booking = await this.bookingRepo.findOne({
            where: { id: bookingId, customer_user_id: actor.userId },
            relations: ["listing"],
        });

        if (!booking) throw new AppError("Booking not found", 404, "NOT_FOUND");

        const restaurant = await this.listingRepo.findOne({
            where: {
                vendor_id: booking.listing.vendor_id ?? undefined,
                type: ListingType.RESTAURANT,
                status: "active" as any, // Only active restaurants
            },
            relations: ["restaurant_details"],
        });

        if (!restaurant) {
            return {
                available: false,
                reason: "No restaurant available for this hotel.",
            };
        }

        const workspaceMeta = (restaurant.restaurant_details?.opening_hours as any)?.['__restaurant_workspace'];
        const menuSections = workspaceMeta?.menuSections || [];

        return {
            available: true,
            restaurant_id: restaurant.id,
            name: restaurant.name,
            allow_online_orders: !!restaurant.restaurant_details?.allow_online_orders,
            auto_confirm_online_orders: !!restaurant.restaurant_details?.accepting_orders_now, // The "accepting_orders_now" is treated as auto-confirm as per plan
            menu: menuSections,
        };
    }

    public async updateOrderStatus(actor: AuthActor, orderId: string, dto: IUpdateOrderStatusDTO): Promise<IRestaurantOrderDTO> {
        return AppDataSource.manager.transaction(async (manager) => {
            const order = await manager.getRepository(RestaurantOrder).findOne({
                where: { id: orderId },
                relations: ["booking"],
            });

            if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
            if (order.vendor_id !== actor.userId) throw new AppError("Unauthorized", 403, "FORBIDDEN");

            const oldStatus = order.status;
            order.status = dto.status;

            if (dto.status === "confirmed" && oldStatus !== "confirmed") {
                order.confirmed_at = new Date();
                
                // If it's linked to a booking and doesn't have a bill item yet, create one
                if (order.booking_id && !order.booking_bill_item_id) {
                    const bill = await this.getOrCreateBill(manager, order.booking_id);
                    const billItem = manager.getRepository(BookingBillItem).create({
                        bill_id: bill.id,
                        item_name: `Restaurant Order`,
                        amount: order.total_amount,
                        notes: `Order items: \n${order.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}`,
                        created_by_user_id: actor.userId,
                    });
                    await manager.save(billItem);
                    order.booking_bill_item_id = billItem.id;
                }
            } else if (dto.status === "served" && oldStatus !== "served") {
                order.served_at = new Date();
            } else if (dto.status === "cancelled" && oldStatus !== "cancelled") {
                // If there's a bill item, we might need to handle it or block it. 
                // Plan says: "allow cancellation only before confirmation, unless a proper bill-void flow is added."
                if (order.booking_bill_item_id) {
                    throw new AppError("Cannot cancel a confirmed order that has already been billed. Void the bill first or handle refunds.", 400, "BAD_REQUEST");
                }
                order.cancelled_at = new Date();
            }

            await manager.save(order);
            return this.toDTO(order);
        });
    }

    public async updateOrderDetails(actor: AuthActor, orderId: string, dto: IUpdateOrderDTO): Promise<IRestaurantOrderDTO> {
        const order = await this.orderRepo.findOne({
            where: { id: orderId }
        });

        if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
        if (order.vendor_id !== actor.userId) throw new AppError("Unauthorized", 403, "FORBIDDEN");
        
        // Items can only be updated if not yet billed/confirmed
        if (dto.items && order.booking_bill_item_id) {
            throw new AppError("Cannot modify items after order has been billed", 400, "BAD_REQUEST");
        }

        if (dto.items) {
            order.items = dto.items;
            order.total_amount = dto.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        }
        if (dto.notes !== undefined) order.notes = dto.notes;
        if (dto.customer_name !== undefined) order.customer_name = dto.customer_name;
        if (dto.customer_phone !== undefined) order.customer_phone = dto.customer_phone;
        if (dto.requested_for !== undefined) order.requested_for = dto.requested_for ? new Date(dto.requested_for) : null;

        await this.orderRepo.save(order);
        return this.toDTO(order);
    }

    public async recordVendorPayment(actor: AuthActor, orderId: string, amount: number): Promise<IRestaurantOrderDTO> {
        return AppDataSource.manager.transaction(async (manager) => {
            const order = await manager.getRepository(RestaurantOrder).findOne({
                where: { id: orderId },
                relations: ["booking"],
            });

            if (!order) throw new AppError("Order not found", 404, "NOT_FOUND");
            if (order.vendor_id !== actor.userId) throw new AppError("Unauthorized", 403, "FORBIDDEN");

            const totalAmount = Number(order.total_amount);
            const currentPaid = Number(order.paid_amount || 0);
            const newPaid = currentPaid + amount;

            if (newPaid > totalAmount) {
                throw new AppError(`Payment exceeds outstanding balance of ${totalAmount - currentPaid}`, 400, "BAD_REQUEST");
            }

            order.paid_amount = newPaid;
            order.payment_status = newPaid >= totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";

            await manager.save(order);
            return this.toDTO(order);
        });
    }

    private async getOrCreateBill(manager: any, bookingId: string): Promise<BookingBill> {
        let bill = await manager.getRepository(BookingBill).findOne({ where: { booking_id: bookingId } });
        if (!bill) {
            bill = manager.getRepository(BookingBill).create({
                booking_id: bookingId,
                currency: "PKR"
            });
            await manager.save(bill);
        }
        return bill;
    }

    private toDTO(order: RestaurantOrder): IRestaurantOrderDTO {
        return {
            id: order.id,
            restaurant_id: order.restaurant_id,
            vendor_id: order.vendor_id,
            booking_id: order.booking_id,
            guest_user_id: order.guest_user_id,
            source: order.source as "online" | "manual",
            status: order.status as any,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            notes: order.notes,
            items: order.items,
            total_amount: Number(order.total_amount),
            paid_amount: Number(order.paid_amount || 0),
            payment_status: order.payment_status as any,
            requested_for: order.requested_for?.toISOString() ?? null,
            confirmed_at: order.confirmed_at?.toISOString() ?? null,
            served_at: order.served_at?.toISOString() ?? null,
            cancelled_at: order.cancelled_at?.toISOString() ?? null,
            created_at: order.created_at.toISOString(),
            updated_at: order.updated_at.toISOString(),
            booking_bill_item_id: order.booking_bill_item_id,
            guest: order.guest ? {
                name: order.guest.profile?.username ?? order.guest.email,
                email: order.guest.email,
                phone: order.guest.profile?.phone_number ?? undefined,
            } : undefined,
            booking: order.booking ? {
                check_in: order.booking.check_in_date.toString(),
                check_out: order.booking.check_out_date.toString(),
                rooms_count: order.booking.rooms_count,
            } : undefined,
        };
    }

    public async emailReceipt(actor: AuthActor, orderId: string, email: string, subject: string, html: string) {
        const order = await this.orderRepo.findOne({
            where: { id: orderId },
            relations: ["restaurant"],
        });

        if (!order) {
            throw new AppError("Order not found", 404, "NOT_FOUND");
        }

        if (order.restaurant.vendor_id !== actor.userId) {
            throw new AppError("Unauthorized", 403, "FORBIDDEN");
        }

        await sendEmail({
            to: email,
            subject,
            html
        });
    }
}
