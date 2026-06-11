import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { AdminVendorPolicyController } from "@modules/user/controller/admin-vendor-policy.controller";
import { AdminVendorPolicyService } from "@modules/user/service/admin-vendor-policy.service";
import { IUpdateVendorPolicyDto } from "@modules/user/types/vendor-policy.types";

export default async function adminVendorPolicyRoutes(fastify: FastifyInstance) {
    const service = new AdminVendorPolicyService();
    const controller = new AdminVendorPolicyController(service);
    const preHandler = [authenticate, authorizeAdmin];

    fastify.get(
        "/admin/vendor-policy/current",
        { preHandler },
        controller.getCurrentPolicy.bind(controller),
    );

    fastify.put<{ Body: IUpdateVendorPolicyDto }>(
        "/admin/vendor-policy/current",
        { preHandler },
        controller.updateCurrentPolicy.bind(controller),
    );
}
