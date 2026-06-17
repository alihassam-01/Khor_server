import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { AdminPublicPolicyController } from "@modules/user/controller/admin-public-policy.controller";
import { AdminPublicPolicyService } from "@modules/user/service/admin-public-policy.service";
import { IUpdatePublicPoliciesDto } from "@modules/user/types/public-policy.types";

export default async function adminPublicPolicyRoutes(fastify: FastifyInstance) {
    const service = new AdminPublicPolicyService();
    const controller = new AdminPublicPolicyController(service);
    const preHandler = [authenticate, authorizeAdmin];

    fastify.get(
        "/admin/public-policies/current",
        { preHandler },
        controller.getCurrentPolicies.bind(controller),
    );

    fastify.put<{ Body: IUpdatePublicPoliciesDto }>(
        "/admin/public-policies/current",
        { preHandler },
        controller.updateCurrentPolicies.bind(controller),
    );
}
