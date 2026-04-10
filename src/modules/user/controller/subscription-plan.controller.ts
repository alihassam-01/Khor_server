import { FastifyRequest, FastifyReply } from "fastify";
import { SubscriptionPlanService } from "@modules/user/service/subscription-plan.service";
import { 
    ICreateSubscriptionPlanDTO, 
    IUpdateSubscriptionPlanDTO, 
    ISubscriptionPlanDTO, 
    IFeaturedPricingDTO 
} from "@modules/user/dtos";
import { 
    ISubscriptionPlanIdParams, 
    ISubscriptionPlanTypeParams 
} from "@modules/user/types";

export class SubscriptionPlanController {
    private planService = new SubscriptionPlanService();

    // ========== PUBLIC ENDPOINTS ==========

    async getAllPlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const plans: ISubscriptionPlanDTO[] = await this.planService.getAllPlans();
            reply.send(plans);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch plans" });
        }
    }

    async getPlanByType(
        req: FastifyRequest<{ Params: ISubscriptionPlanTypeParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { type } = req.params;
            const plan: ISubscriptionPlanDTO | null = await this.planService.getPlanByType(type);

            if (!plan) {
                return reply.code(404).send({ message: "Plan not found" });
            }

            reply.send(plan);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch plan" });
        }
    }

    async getFeaturedPricing(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const pricing: IFeaturedPricingDTO = await this.planService.getFeaturedPricing();
            reply.send(pricing);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({
                    message: err.message || "Failed to fetch featured pricing",
                });
        }
    }

    async comparePlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const comparison = await this.planService.comparePlans();
            reply.send(comparison);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to compare plans" });
        }
    }

    // ========== ADMIN ENDPOINTS ==========

    async getAllPlansAdmin(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const plans: ISubscriptionPlanDTO[] = await this.planService.getAllPlans(true); // Include inactive
            reply.send(plans);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch plans" });
        }
    }

    async getPlanById(
        req: FastifyRequest<{ Params: ISubscriptionPlanIdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            const plan: ISubscriptionPlanDTO | null = await this.planService.getPlanById(id);

            if (!plan) {
                return reply.code(404).send({ message: "Plan not found" });
            }

            reply.send(plan);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch plan" });
        }
    }

    async createPlan(
        req: FastifyRequest<{ Body: ICreateSubscriptionPlanDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const planData = req.body;
            const plan: ISubscriptionPlanDTO = await this.planService.createPlan(planData);
            reply.code(201).send(plan);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to create plan" });
        }
    }

    async updatePlan(
        req: FastifyRequest<{ Params: ISubscriptionPlanIdParams; Body: IUpdateSubscriptionPlanDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const plan: ISubscriptionPlanDTO = await this.planService.updatePlan(id, updateData);
            reply.send(plan);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to update plan" });
        }
    }

    async deletePlan(
        req: FastifyRequest<{ Params: ISubscriptionPlanIdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = req.params;
            await this.planService.deletePlan(id);
            reply.code(204).send();
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(400)
                .send({ message: err.message || "Failed to delete plan" });
        }
    }

    async seedPlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            await this.planService.seedDefaultPlans();
            reply.send({ message: "Default plans seeded successfully" });
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to seed plans" });
        }
    }
}
