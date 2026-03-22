import { FastifyInstance } from "fastify";
import { AdPaymentController } from "@modules/user/controller/ad-payment.controller";

export async function adPaymentRoutes(fastify: FastifyInstance) {
    const paymentController = new AdPaymentController();

    // Admin routes for payment management
    fastify.post(
        "/admin/payments",
        paymentController.createPayment.bind(paymentController)
    );
    fastify.get(
        "/admin/payments",
        paymentController.getAllPayments.bind(paymentController)
    );
    fastify.get(
        "/admin/payments/:id",
        paymentController.getPaymentById.bind(paymentController)
    );
    fastify.patch(
        "/admin/payments/:id/status",
        paymentController.updatePaymentStatus.bind(paymentController)
    );
    fastify.get(
        "/admin/payments/vendor/:vendorId",
        paymentController.getPaymentsByVendor.bind(paymentController)
    );
    fastify.get(
        "/admin/payments/ad/:adId/:adType",
        paymentController.getPaymentsByAd.bind(paymentController)
    );
    fastify.get(
        "/admin/payments/pending",
        paymentController.getPendingPayments.bind(paymentController)
    );
    fastify.delete(
        "/admin/payments/:id",
        paymentController.deletePayment.bind(paymentController)
    );
}
