import { FastifyInstance } from "fastify";
import { SubscriptionPlanController } from "@modules/user/controller/subscription-plan.controller";
import { ICreateSubscriptionPlanDTO, IUpdateSubscriptionPlanDTO } from "@modules/user/dtos";
import { ISubscriptionPlanIdParams } from "@modules/user/types";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";

export async function subscriptionPlanRoutes(fastify: FastifyInstance) {
    const planController = new SubscriptionPlanController();

    // ========== PUBLIC ROUTES ==========
    // Anyone can view subscription plans

    fastify.get(
        "/subscription-plans",
        planController.getAllPlans.bind(planController)
    );

    fastify.get(
        "/subscription-plans/compare",
        planController.comparePlans.bind(planController)
    );

    fastify.get(
        "/subscription-plans/:type",
        planController.getPlanByType.bind(planController)
    );

    fastify.get(
        "/subscription-plans/featured/pricing",
        planController.getFeaturedPricing.bind(planController)
    );

    // ========== ADMIN ROUTES ==========
    // Manage subscription plans

    fastify.get(
        "/admin/subscription-plans",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.getAllPlansAdmin.bind(planController)
    );

    fastify.get<{ Params: ISubscriptionPlanIdParams }>(
        "/admin/subscription-plans/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.getPlanById.bind(planController)
    );

    fastify.post<{ Body: ICreateSubscriptionPlanDTO }>(
        "/admin/subscription-plans",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.createPlan.bind(planController)
    );

    fastify.put<{ Params: ISubscriptionPlanIdParams; Body: IUpdateSubscriptionPlanDTO }>(
        "/admin/subscription-plans/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.updatePlan.bind(planController)
    );

    fastify.delete<{ Params: ISubscriptionPlanIdParams }>(
        "/admin/subscription-plans/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.deletePlan.bind(planController)
    );

    fastify.post(
        "/admin/subscription-plans/seed",
        { preHandler: [authenticate, authorizeAdmin] },
        planController.seedPlans.bind(planController)
    );
}
