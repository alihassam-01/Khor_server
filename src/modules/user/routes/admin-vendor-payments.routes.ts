import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { AdminVendorPaymentsController } from "@modules/user/controller/admin-vendor-payments.controller";

export async function adminVendorPaymentsRoutes(fastify: FastifyInstance) {
    const controller = new AdminVendorPaymentsController();

    fastify.get(
        "/admin/vendor-payments/overview",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.getMonthlyOverview.bind(controller),
    );

    fastify.get(
        "/admin/vendor-payments/:vendorId/ledger",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.getVendorLedger.bind(controller),
    );

    fastify.post(
        "/admin/vendor-payments/subscription-payment",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.recordSubscriptionPayment.bind(controller),
    );

    fastify.patch(
        "/admin/vendor-payments/:vendorId/subscription-type",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.updateSubscriptionType.bind(controller),
    );
}
