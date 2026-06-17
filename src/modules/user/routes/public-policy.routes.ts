import { FastifyInstance } from "fastify";
import { PublicPolicyController } from "@modules/user/controller/public-policy.controller";

export default async function publicPolicyRoutes(fastify: FastifyInstance) {
    const controller = new PublicPolicyController();

    fastify.get(
        "/public-policies/current",
        controller.getCurrentPolicies.bind(controller),
    );
}
