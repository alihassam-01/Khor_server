import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { BookingPayoutController } from "@modules/user/controller/booking-payout.controller";
import { ICreateBookingPayoutDTO, IUpdateBookingPayoutDTO } from "@modules/user/dtos";
import { IBookingPayoutIdParams, IGetBookingPayoutsByVendorParams } from "@modules/user/types";

export async function payoutRoutes(fastify: FastifyInstance) {
    const controller = new BookingPayoutController();

    fastify.get(
        "/payouts",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.getAllPayouts.bind(controller),
    );

    fastify.get<{ Params: IGetBookingPayoutsByVendorParams }>(
        "/payouts/vendor/:vendorId",
        { preHandler: authenticate },
        controller.getPayoutsByVendor.bind(controller),
    );

    fastify.post<{ Body: ICreateBookingPayoutDTO }>(
        "/payouts",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.createPayout.bind(controller),
    );

    fastify.patch<{ Params: IBookingPayoutIdParams; Body: IUpdateBookingPayoutDTO }>(
        "/payouts/:id/status",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.updatePayoutStatus.bind(controller),
    );
}
