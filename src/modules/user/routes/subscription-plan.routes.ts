import { FastifyInstance } from "fastify";
import { SubscriptionPlanController } from "../controller/subscription-plan.controller";

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
        planController.getAllPlansAdmin.bind(planController)
    );

    fastify.get(
        "/admin/subscription-plans/:id",
        planController.getPlanById.bind(planController)
    );

    fastify.post(
        "/admin/subscription-plans",
        planController.createPlan.bind(planController)
    );

    fastify.put(
        "/admin/subscription-plans/:id",
        planController.updatePlan.bind(planController)
    );

    fastify.delete(
        "/admin/subscription-plans/:id",
        planController.deletePlan.bind(planController)
    );

    fastify.post(
        "/admin/subscription-plans/seed",
        planController.seedPlans.bind(planController)
    );
}
