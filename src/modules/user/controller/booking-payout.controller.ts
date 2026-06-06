import { FastifyReply, FastifyRequest } from "fastify";
import { BookingPayoutService } from "@modules/user/service/booking-payout.service";
import { IBookingPayoutIdParams, IGetBookingPayoutsByVendorParams } from "@modules/user/types";
import { ICreateBookingPayoutDTO, IUpdateBookingPayoutDTO } from "@modules/user/dtos";
import { UserRole } from "@common/enums";

export class BookingPayoutController {
    private payoutService = new BookingPayoutService();

    async getAllPayouts(_req: FastifyRequest, reply: FastifyReply) {
        const payouts = await this.payoutService.getAllPayouts();
        reply.send(payouts);
    }

    async getPayoutsByVendor(
        req: FastifyRequest<{ Params: IGetBookingPayoutsByVendorParams }>,
        reply: FastifyReply,
    ) {
        const authUser = (req.user ?? {}) as { id?: string; userId?: string; userType?: UserRole };
        const authUserId = authUser.id || authUser.userId;
        const isAdmin = authUser.userType === UserRole.ADMIN;
        const isOwnVendorAccount = authUser.userType === UserRole.VENDOR && authUserId === req.params.vendorId;

        if (!isAdmin && !isOwnVendorAccount) {
            return reply.status(403).send({
                message: "Forbidden: You can only view payouts for your own account.",
            });
        }

        const payouts = await this.payoutService.getPayoutsByVendor(req.params.vendorId);
        reply.send(payouts);
    }

    async createPayout(
        req: FastifyRequest<{ Body: ICreateBookingPayoutDTO }>,
        reply: FastifyReply,
    ) {
        const payout = await this.payoutService.createPayout(req.body);
        reply.code(201).send(payout);
    }

    async updatePayoutStatus(
        req: FastifyRequest<{ Params: IBookingPayoutIdParams; Body: IUpdateBookingPayoutDTO }>,
        reply: FastifyReply,
    ) {
        const payout = await this.payoutService.updatePayoutStatus(req.params.id, req.body);
        reply.send(payout);
    }
}
