import { FastifyRequest, FastifyReply } from "fastify";
import { AdPaymentService } from "@modules/user/service/ad-payment.service";
import {
    ICreateAdPaymentDTO,
    IUpdateAdPaymentDTO,
} from "../dtos/ad-payment.dto";
import { AdType } from "@modules/user/entity/ENUM/ad-payment.enum";

export class AdPaymentController {
    private paymentService = new AdPaymentService();

    async createPayment(req: FastifyRequest, reply: FastifyReply) {
        try {
            const paymentData = req.body as ICreateAdPaymentDTO;
            const payment = await this.paymentService.createPayment(paymentData);
            reply.code(201).send(payment);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to create payment" });
        }
    }

    async updatePaymentStatus(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const updateData = req.body as IUpdateAdPaymentDTO;
            const payment = await this.paymentService.updatePaymentStatus(
                id,
                updateData
            );
            reply.send(payment);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to update payment" });
        }
    }

    async getPaymentById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const payment = await this.paymentService.getPaymentById(id);

            if (!payment) {
                reply.code(404).send({ message: "Payment not found" });
                return;
            }

            reply.send(payment);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch payment" });
        }
    }

    async getPaymentsByVendor(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { vendorId } = req.params as { vendorId: string };
            const payments = await this.paymentService.getPaymentsByVendor(vendorId);
            reply.send(payments);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch payments" });
        }
    }

    async getPaymentsByAd(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { adId, adType } = req.params as { adId: string; adType: string };
            const payments = await this.paymentService.getPaymentsByAd(
                adId,
                adType as AdType
            );
            reply.send(payments);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch payments" });
        }
    }

    async getPendingPayments(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const payments = await this.paymentService.getPendingPayments();
            reply.send(payments);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch pending payments" });
        }
    }

    async getAllPayments(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const payments = await this.paymentService.getAllPayments();
            reply.send(payments);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch payments" });
        }
    }

    async deletePayment(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            await this.paymentService.deletePayment(id);
            reply.code(204).send();
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to delete payment" });
        }
    }
}
