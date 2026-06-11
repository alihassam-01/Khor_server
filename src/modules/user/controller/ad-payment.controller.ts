import { FastifyRequest, FastifyReply } from "fastify";
import { AdPaymentService } from "@modules/user/service/ad-payment.service";
import {
    ICreateAdPaymentDTO,
    IUpdateAdPaymentDTO,
    IAdPaymentDTO,
} from "@modules/user/dtos";
import { PropertyType } from "@common/enums";
import { 
    IAdPaymentIdParams, 
    IGetPaymentsByAdParams, 
    IGetPaymentsByVendorParams 
} from "@modules/user/types";

export class AdPaymentController {
    private paymentService = new AdPaymentService();
    private getAuthUserId(req: FastifyRequest): string | null {
        return (req.user as any)?.id || (req.user as any)?.userId || null;
    }

    async createVendorPayment(
        req: FastifyRequest<{ Body: ICreateAdPaymentDTO }>,
        reply: FastifyReply
    ) {
        try {
            const vendorId = this.getAuthUserId(req);
            if (!vendorId) {
                reply.code(401).send({ message: "Authentication required" });
                return;
            }

            const payment = await this.paymentService.createPaymentForVendor(vendorId, req.body);
            reply.code(201).send(payment);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to create vendor payment" });
        }
    }

    async createPayment(
        req: FastifyRequest<{ Body: ICreateAdPaymentDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const paymentData = req.body;
            const payment: IAdPaymentDTO = await this.paymentService.createPayment(paymentData);
            reply.code(201).send(payment);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to create payment" });
        }
    }

    async updatePaymentStatus(
        req: FastifyRequest<{ Params: IAdPaymentIdParams; Body: IUpdateAdPaymentDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const payment: IAdPaymentDTO = await this.paymentService.updatePaymentStatus(
                id,
                updateData
            );
            reply.send(payment);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to update payment" });
        }
    }

    async getPaymentById(
        req: FastifyRequest<{ Params: IAdPaymentIdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            const payment = await this.paymentService.getPaymentById(id);

            if (!payment) {
                reply.code(404).send({ message: "Payment not found" });
                return;
            }

            reply.send(payment);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch payment" });
        }
    }

    async getPaymentsByVendor(
        req: FastifyRequest<{ Params: IGetPaymentsByVendorParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { vendorId } = req.params;
            const payments = await this.paymentService.getPaymentsByVendor(vendorId);
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch payments" });
        }
    }

    async getPaymentsByAd(
        req: FastifyRequest<{ Params: IGetPaymentsByAdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { adId, adType } = req.params;
            const payments = await this.paymentService.getPaymentsByAd(
                adId,
                adType as PropertyType
            );
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch payments" });
        }
    }

    async getPendingPayments(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const payments = await this.paymentService.getPendingPayments();
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch pending payments" });
        }
    }

    async getAllPayments(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const payments = await this.paymentService.getAllPayments();
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch payments" });
        }
    }

    async getVendorPayments(req: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = this.getAuthUserId(req);
            if (!userId) {
                reply.code(403).send({ message: "Vendor User ID not found" });
                return;
            }
            const payments = await this.paymentService.getPaymentsByVendor(userId);
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch vendor payments" });
        }
    }

    async getVendorPaymentsByAd(
        req: FastifyRequest<{ Params: IGetPaymentsByAdParams }>,
        reply: FastifyReply
    ) {
        try {
            const userId = this.getAuthUserId(req);
            if (!userId) {
                reply.code(403).send({ message: "Vendor User ID not found" });
                return;
            }

            const { adId, adType } = req.params;
            const payments = await this.paymentService.getPaymentsByAdForVendor(
                userId,
                adId,
                adType as PropertyType,
            );
            reply.send(payments);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch vendor ad payments" });
        }
    }

    async deletePayment(
        req: FastifyRequest<{ Params: IAdPaymentIdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            await this.paymentService.deletePayment(id);
            reply.code(204).send();
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to delete payment" });
        }
    }
}
