import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import jwt from "jsonwebtoken";
import { CONFIG } from "@config/config";
import { UserRole } from "@common/enums/user.enums";
import { BookingController } from "@modules/user/controller/booking.controller";
import { bookingRealtimeService, BookingRealtimeEvent } from "@modules/user/service/booking-realtime.service";
import {
    ICreateHotelBookingHoldDTO,
    ICreateHotelBookingDTO,
    IRecordBookingPaymentDTO,
    IRefundRequestDTO,
} from "@modules/user/dtos";
import {
    IAvailabilityQuery,
    IBookingActionBody,
    IBookingIdParams,
    IBookingListQuery,
    IHotelAvailabilityParams,
    IRoomTypeBookingParams,
    IRefundIdParams,
    IRefundListQuery,
    IRefundProcessBody,
} from "@modules/user/types";

type StreamAuthQuery = { token?: string };
type HotelEventStreamParams = { id: string };

const getStreamToken = (request: FastifyRequest<{ Querystring: StreamAuthQuery }>): string | null => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.split(" ")[1];
    }
    return request.query?.token ?? null;
};

const getStreamActor = (
    request: FastifyRequest<{ Querystring: StreamAuthQuery }>,
): { userId: string; userType: UserRole } | null => {
    const token = getStreamToken(request);
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, CONFIG.jwt.secret as string) as {
            userId?: string;
            id?: string;
            userType?: UserRole;
        };

        const userId = decoded.userId || decoded.id;
        if (!userId || !decoded.userType) {
            return null;
        }

        return { userId, userType: decoded.userType };
    } catch {
        return null;
    }
};

const beginSse = (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin ?? "*";
    reply.hijack();
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
    });
    reply.raw.write("retry: 10000\n\n");
};

const writeSseEvent = (reply: FastifyReply, event: BookingRealtimeEvent) => {
    reply.raw.write(`event: booking-event\n`);
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export async function bookingRoutes(fastify: FastifyInstance) {
    const bookingController = new BookingController();

    fastify.post<{ Body: ICreateHotelBookingDTO }>(
        "/bookings/hotel",
        { preHandler: authenticate },
        bookingController.createCustomerBooking.bind(bookingController),
    );

    fastify.post<{ Body: ICreateHotelBookingHoldDTO }>(
        "/bookings/hotel/hold",
        { preHandler: authenticate },
        bookingController.createCustomerHold.bind(bookingController),
    );

    fastify.get<{ Querystring: IBookingListQuery }>(
        "/bookings/me",
        { preHandler: authenticate },
        bookingController.listCustomerBookings.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/bookings/:id",
        { preHandler: authenticate },
        bookingController.getCustomerBooking.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/bookings/:id/timeline",
        { preHandler: authenticate },
        bookingController.getCustomerBookingTimeline.bind(bookingController),
    );

    fastify.post<{ Params: IBookingIdParams; Body: IBookingActionBody }>(
        "/bookings/:id/cancel-request",
        { preHandler: authenticate },
        bookingController.requestCustomerCancellation.bind(bookingController),
    );

    fastify.post<{ Body: IRefundRequestDTO }>(
        "/bookings/refund-request",
        { preHandler: authenticate },
        bookingController.requestCustomerRefund.bind(bookingController),
    );

    fastify.post<{ Body: ICreateHotelBookingDTO }>(
        "/vendor/bookings",
        { preHandler: authenticate },
        bookingController.createVendorBooking.bind(bookingController),
    );

    fastify.get<{ Querystring: IBookingListQuery }>(
        "/vendor/bookings",
        { preHandler: authenticate },
        bookingController.listVendorBookings.bind(bookingController),
    );

    fastify.get(
        "/vendor/booking-holds",
        { preHandler: authenticate },
        bookingController.listVendorBookingHolds.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/vendor/bookings/:id",
        { preHandler: authenticate },
        bookingController.getVendorBooking.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/vendor/bookings/:id/timeline",
        { preHandler: authenticate },
        bookingController.getVendorBookingTimeline.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams }>(
        "/vendor/bookings/:id/confirm",
        { preHandler: authenticate },
        bookingController.confirmVendorBooking.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams; Body: IBookingActionBody }>(
        "/vendor/bookings/:id/cancel",
        { preHandler: authenticate },
        bookingController.cancelVendorBooking.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams }>(
        "/vendor/bookings/:id/check-in",
        { preHandler: authenticate },
        bookingController.checkInVendorBooking.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams }>(
        "/vendor/bookings/:id/complete",
        { preHandler: authenticate },
        bookingController.completeVendorBooking.bind(bookingController),
    );

    fastify.post<{ Params: IBookingIdParams; Body: IRecordBookingPaymentDTO }>(
        "/vendor/bookings/:id/payments",
        { preHandler: authenticate },
        bookingController.recordVendorPayment.bind(bookingController),
    );

    fastify.get<{ Querystring: IBookingListQuery }>(
        "/admin/bookings",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.listAdminBookings.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/admin/bookings/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.getAdminBooking.bind(bookingController),
    );

    fastify.get<{ Params: IBookingIdParams }>(
        "/admin/bookings/:id/timeline",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.getAdminBookingTimeline.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams; Body: IBookingActionBody }>(
        "/admin/bookings/:id/cancel",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.cancelAdminBooking.bind(bookingController),
    );

    fastify.patch<{ Params: IBookingIdParams }>(
        "/admin/bookings/:id/complete",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.completeAdminBooking.bind(bookingController),
    );

    fastify.get<{ Querystring: IRefundListQuery }>(
        "/admin/refunds",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.listAdminRefunds.bind(bookingController),
    );

    fastify.get<{ Params: IRefundIdParams }>(
        "/admin/refunds/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.getAdminRefund.bind(bookingController),
    );

    fastify.patch<{ Params: IRefundIdParams; Body: IBookingActionBody }>(
        "/admin/refunds/:id/approve",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.approveRefund.bind(bookingController),
    );

    fastify.patch<{ Params: IRefundIdParams; Body: IBookingActionBody }>(
        "/admin/refunds/:id/reject",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.rejectRefund.bind(bookingController),
    );

    fastify.patch<{ Params: IRefundIdParams; Body: IRefundProcessBody }>(
        "/admin/refunds/:id/process",
        { preHandler: [authenticate, authorizeAdmin] },
        bookingController.processRefund.bind(bookingController),
    );

    fastify.get<{ Params: IHotelAvailabilityParams; Querystring: IAvailabilityQuery }>(
        "/hotels/:id/room-types/:roomTypeId/availability",
        bookingController.getAvailability.bind(bookingController),
    );

    fastify.get<{ Params: HotelEventStreamParams }>(
        "/hotels/:id/events/stream",
        async (request, reply) => {
            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = bookingRealtimeService.subscribe({
                id: `hotel:${request.params.id}:${Date.now()}:${Math.random()}`,
                scope: "hotel",
                hotelId: request.params.id,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );

    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/vendor/booking-events/stream",
        async (request, reply) => {
            const actor = getStreamActor(request);
            if (!actor || actor.userType !== UserRole.VENDOR) {
                reply.code(401).send({ message: "Invalid token" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = bookingRealtimeService.subscribe({
                id: `vendor:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "vendor",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );

    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/admin/booking-events/stream",
        async (request, reply) => {
            const actor = getStreamActor(request);
            if (!actor || actor.userType !== UserRole.ADMIN) {
                reply.code(401).send({ message: "Invalid token" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = bookingRealtimeService.subscribe({
                id: `admin:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "admin",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );

    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/bookings/events/stream",
        async (request, reply) => {
            const actor = getStreamActor(request);
            if (!actor || actor.userType !== UserRole.CUSTOMER) {
                reply.code(401).send({ message: "Invalid token" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = bookingRealtimeService.subscribe({
                id: `customer:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "customer",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );

    fastify.get<{ Params: IRoomTypeBookingParams }>(
        "/bookings/roomtype/:roomTypeId/booked-dates",
        bookingController.getBookedDatesForRoomType.bind(bookingController),
    );
}
