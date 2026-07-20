import { FastifyInstance } from "fastify";
import { RestaurantOrderController } from "../controller/restaurant-order.controller";
import { authenticate } from "@middlewares/authenticate";

export async function restaurantOrderRoutes(fastify: FastifyInstance) {
    const controller = new RestaurantOrderController();

    // Guest routes
    fastify.get<{ Params: { bookingId: string } }>(
        "/bookings/:bookingId/restaurant-ordering",
        { preHandler: authenticate },
        controller.getRestaurantOrderingContext
    );

    fastify.post<{ Params: { bookingId: string } }>(
        "/bookings/:bookingId/restaurant-orders",
        { preHandler: authenticate },
        controller.createOnlineOrder
    );

    fastify.get<{ Params: { bookingId: string } }>(
        "/bookings/:bookingId/restaurant-orders",
        { preHandler: authenticate },
        controller.listGuestOrders
    );

    // Vendor routes
    fastify.post<{ Params: { orderId: string }, Body: { html: string, email: string, subject: string } }>(
        "/vendor/restaurant-orders/:orderId/email-receipt",
        {
            preHandler: [authenticate],
            schema: { tags: ["Vendor Restaurant Orders"], body: { type: "object" } },
        },
        controller.emailReceipt,
    );



    fastify.get(
        "/vendor/restaurant-orders",
        { preHandler: authenticate },
        controller.listVendorOrders
    );

    fastify.post(
        "/vendor/restaurant-orders",
        { preHandler: authenticate },
        controller.createManualOrder
    );

    fastify.patch<{ Params: { orderId: string } }>(
        "/vendor/restaurant-orders/:orderId",
        { preHandler: authenticate },
        controller.updateOrderDetails
    );

    fastify.patch<{ Params: { orderId: string } }>(
        "/vendor/restaurant-orders/:orderId/status",
        { preHandler: authenticate },
        controller.updateOrderStatus
    );

    fastify.post<{ Params: { orderId: string }, Body: { amount: number } }>(
        "/vendor/restaurant-orders/:orderId/payments",
        { preHandler: authenticate },
        controller.recordVendorPayment
    );
}
