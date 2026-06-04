import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "@common/enums/user.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { BookingService } from "@modules/user/service/booking.service";
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
    IBookingPaymentStatusParams,
    IRefundIdParams,
    IRefundListQuery,
    IRefundProcessBody,
    IHotelAvailabilityParams,
    IPayFastReturnParams,
    IRoomTypeBookingParams,
} from "@modules/user/types";

type AuthUser = {
    userId?: string;
    id?: string;
    userType?: UserRole;
};

export class BookingController {
    private readonly bookingService = new BookingService();

    private getActor(req: FastifyRequest): { userId: string; userType: UserRole } {
        const user = (req.user ?? {}) as AuthUser;
        const userId = user.userId || user.id;
        const userType = user.userType;

        if (!userId || !userType) {
            throw new AppError("Authentication required", 401, ErrorCodes.UNAUTHORIZED);
        }

        return { userId, userType };
    }

    async createCustomerBooking(
        req: FastifyRequest<{ Body: ICreateHotelBookingDTO }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.createCustomerBooking(this.getActor(req), req.body);
        reply.code(201).send(booking);
    }

    async createCustomerCheckout(
        req: FastifyRequest<{ Body: ICreateHotelBookingDTO }>,
        reply: FastifyReply,
    ) {
        const checkout = await this.bookingService.createCustomerCheckout(
            this.getActor(req),
            req.body,
            req.ip,
        );
        reply.code(201).send(checkout);
    }

    async listCustomerBookings(
        req: FastifyRequest<{ Querystring: IBookingListQuery }>,
        reply: FastifyReply,
    ) {
        const { page, limit, booking_status, listing_id } = req.query;
        const response = await this.bookingService.listCustomerBookings(this.getActor(req), {
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            booking_status,
            listing_id,
        });
        reply.send(response);
    }

    async getCustomerBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.getBookingById(
            req.params.id,
            this.getActor(req),
            "customer",
        );
        reply.send(booking);
    }

    async getCustomerBookingTimeline(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const timeline = await this.bookingService.getBookingTimeline(
            req.params.id,
            this.getActor(req),
            "customer",
        );
        reply.send(timeline);
    }

    async requestCustomerCancellation(
        req: FastifyRequest<{ Params: IBookingIdParams; Body: IBookingActionBody }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.requestCustomerCancellation(
            req.params.id,
            this.getActor(req),
            req.body?.reason,
        );
        reply.send(booking);
    }

    async requestCustomerRefund(
        req: FastifyRequest<{ Body: IRefundRequestDTO }>,
        reply: FastifyReply,
    ) {
        const refund = await this.bookingService.requestCustomerRefund(this.getActor(req), req.body);
        reply.code(201).send(refund);
    }

    async createCustomerHold(
        req: FastifyRequest<{ Body: ICreateHotelBookingHoldDTO }>,
        reply: FastifyReply,
    ) {
        const hold = await this.bookingService.createCustomerHold(this.getActor(req), req.body);
        reply.code(201).send(hold);
    }

    async createVendorBooking(
        req: FastifyRequest<{ Body: ICreateHotelBookingDTO }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.createVendorBooking(this.getActor(req), req.body);
        reply.code(201).send(booking);
    }

    async listVendorBookings(
        req: FastifyRequest<{ Querystring: IBookingListQuery }>,
        reply: FastifyReply,
    ) {
        const { page, limit, booking_status, listing_id } = req.query;
        const response = await this.bookingService.listVendorBookings(this.getActor(req), {
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            booking_status,
            listing_id,
        });
        reply.send(response);
    }

    async listVendorBookingHolds(
        req: FastifyRequest,
        reply: FastifyReply,
    ) {
        const holds = await this.bookingService.listVendorBookingHolds(this.getActor(req));
        reply.send(holds);
    }

    async getVendorBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.getBookingById(
            req.params.id,
            this.getActor(req),
            "vendor",
        );
        reply.send(booking);
    }

    async getVendorBookingTimeline(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const timeline = await this.bookingService.getBookingTimeline(
            req.params.id,
            this.getActor(req),
            "vendor",
        );
        reply.send(timeline);
    }

    async confirmVendorBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.confirmVendorBooking(req.params.id, this.getActor(req));
        reply.send(booking);
    }

    async cancelVendorBooking(
        req: FastifyRequest<{ Params: IBookingIdParams; Body: IBookingActionBody }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.cancelVendorBooking(
            req.params.id,
            this.getActor(req),
            req.body?.reason,
        );
        reply.send(booking);
    }

    async checkInVendorBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.checkInVendorBooking(req.params.id, this.getActor(req));
        reply.send(booking);
    }

    async completeVendorBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.completeVendorBooking(req.params.id, this.getActor(req));
        reply.send(booking);
    }

    async recordVendorPayment(
        req: FastifyRequest<{ Params: IBookingIdParams; Body: IRecordBookingPaymentDTO }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.recordVendorPayment(
            req.params.id,
            this.getActor(req),
            req.body,
        );
        reply.send(booking);
    }

    async listAdminBookings(
        req: FastifyRequest<{ Querystring: IBookingListQuery }>,
        reply: FastifyReply,
    ) {
        const { page, limit, booking_status, listing_id } = req.query;
        const response = await this.bookingService.listAdminBookings(this.getActor(req), {
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            booking_status,
            listing_id,
        });
        reply.send(response);
    }

    async getAdminBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.getBookingById(
            req.params.id,
            this.getActor(req),
            "admin",
        );
        reply.send(booking);
    }

    async getAdminBookingTimeline(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const timeline = await this.bookingService.getBookingTimeline(
            req.params.id,
            this.getActor(req),
            "admin",
        );
        reply.send(timeline);
    }

    async cancelAdminBooking(
        req: FastifyRequest<{ Params: IBookingIdParams; Body: IBookingActionBody }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.cancelAdminBooking(
            req.params.id,
            this.getActor(req),
            req.body?.reason,
        );
        reply.send(booking);
    }

    async completeAdminBooking(
        req: FastifyRequest<{ Params: IBookingIdParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.completeAdminBooking(
            req.params.id,
            this.getActor(req),
        );
        reply.send(booking);
    }

    async listAdminRefunds(
        req: FastifyRequest<{ Querystring: IRefundListQuery }>,
        reply: FastifyReply,
    ) {
        const { page, limit, status } = req.query;
        const response = await this.bookingService.listAdminRefunds(this.getActor(req), {
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
        });
        reply.send(response);
    }

    async getAdminRefund(
        req: FastifyRequest<{ Params: IRefundIdParams }>,
        reply: FastifyReply,
    ) {
        const refund = await this.bookingService.getRefundById(
            req.params.id,
            this.getActor(req),
            "admin",
        );
        reply.send(refund);
    }

    async approveRefund(
        req: FastifyRequest<{ Params: IRefundIdParams; Body: IBookingActionBody }>,
        reply: FastifyReply,
    ) {
        const refund = await this.bookingService.approveRefund(
            req.params.id,
            this.getActor(req),
            req.body?.reason,
        );
        reply.send(refund);
    }

    async rejectRefund(
        req: FastifyRequest<{ Params: IRefundIdParams; Body: IBookingActionBody }>,
        reply: FastifyReply,
    ) {
        const refund = await this.bookingService.rejectRefund(
            req.params.id,
            this.getActor(req),
            req.body?.reason,
        );
        reply.send(refund);
    }

    async processRefund(
        req: FastifyRequest<{ Params: IRefundIdParams; Body: IRefundProcessBody }>,
        reply: FastifyReply,
    ) {
        const refund = await this.bookingService.processRefund(
            req.params.id,
            this.getActor(req),
            req.body?.provider_refund_id,
            req.body?.reason,
        );
        reply.send(refund);
    }

    async verifyCustomerPayment(
        req: FastifyRequest<{ Params: IBookingPaymentStatusParams }>,
        reply: FastifyReply,
    ) {
        const booking = await this.bookingService.verifyCustomerPayFastBooking(
            req.params.id,
            this.getActor(req),
        );
        reply.send(booking);
    }

    async handlePayFastReturn(
        req: FastifyRequest<{ Params: IPayFastReturnParams; Body: Record<string, unknown>; Querystring: Record<string, unknown> }>,
        reply: FastifyReply,
    ) {
        const payload = {
            ...(req.query || {}),
            ...(req.body || {}),
        };
        const bookingId = String(payload.booking_id ?? payload.bookingId ?? "");
        const redirectUrl = await this.bookingService.handlePayFastReturn(
            bookingId,
            req.params.result,
            payload,
        );
        const escapedUrl = redirectUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        reply
            .code(200)
            .type("text/html; charset=utf-8")
            .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${escapedUrl}" />
    <title>Redirecting...</title>
  </head>
  <body>
    <p>Redirecting back to booking status...</p>
    <p><a href="${escapedUrl}">Continue</a></p>
    <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
  </body>
</html>`);
    }

    async getAvailability(
        req: FastifyRequest<{ Params: IHotelAvailabilityParams; Querystring: IAvailabilityQuery }>,
        reply: FastifyReply,
    ) {
        const availability = await this.bookingService.getAvailability(
            req.params.id,
            req.params.roomTypeId,
            req.query.check_in_date,
            req.query.check_out_date,
        );
        reply.send(availability);
    }

    async getBookedDatesForRoomType(
        req: FastifyRequest<{ Params: IRoomTypeBookingParams }>,
        reply: FastifyReply,
    ) {
        const ranges = await this.bookingService.getBookedDatesForRoomType(req.params.roomTypeId);
        reply.send(ranges);
    }
}
