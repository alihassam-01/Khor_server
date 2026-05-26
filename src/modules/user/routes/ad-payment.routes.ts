import { FastifyInstance } from "fastify";
import { AdPaymentController } from "@modules/user/controller/ad-payment.controller";
import { ICreateAdPaymentDTO, IUpdateAdPaymentDTO } from "@modules/user/dtos";
import {
    IAdPaymentIdParams,
    IGetPaymentsByAdParams,
    IGetPaymentsByVendorParams,
} from "@modules/user/types";

import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";

export async function adPaymentRoutes(fastify: FastifyInstance) {
    const paymentController = new AdPaymentController();

    // Vendor routes
    fastify.get(
        "/vendor/payments",
        { preHandler: authenticate },
        paymentController.getVendorPayments.bind(paymentController)
    );

    // Admin routes for payment management
    fastify.post<{ Body: ICreateAdPaymentDTO }>(
        "/admin/payments",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.createPayment.bind(paymentController)
    );
    fastify.get(
        "/admin/payments",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.getAllPayments.bind(paymentController)
    );
    fastify.get<{ Params: IAdPaymentIdParams }>(
        "/admin/payments/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.getPaymentById.bind(paymentController)
    );
    fastify.patch<{ Params: IAdPaymentIdParams; Body: IUpdateAdPaymentDTO }>(
        "/admin/payments/:id/status",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.updatePaymentStatus.bind(paymentController)
    );
    fastify.get<{ Params: IGetPaymentsByVendorParams }>(
        "/admin/payments/vendor/:vendorId",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.getPaymentsByVendor.bind(paymentController)
    );
    fastify.get<{ Params: IGetPaymentsByAdParams }>(
        "/admin/payments/ad/:adId/:adType",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.getPaymentsByAd.bind(paymentController)
    );
    fastify.get(
        "/admin/payments/pending",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.getPendingPayments.bind(paymentController)
    );
    fastify.delete<{ Params: IAdPaymentIdParams }>(
        "/admin/payments/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        paymentController.deletePayment.bind(paymentController)
    );
}
