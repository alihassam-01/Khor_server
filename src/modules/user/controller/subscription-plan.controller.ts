import { FastifyRequest, FastifyReply } from "fastify";
import { SubscriptionPlanService } from "../service/subscription-plan.service";
import { SubscriptionType } from "../entity/ENUM/ad-payment.enum";
import {
    ICreateSubscriptionPlanDTO,
    IUpdateSubscriptionPlanDTO,
} from "../dtos/subscription-plan.dto";

export class SubscriptionPlanController {
    private planService = new SubscriptionPlanService();

    // ========== PUBLIC ENDPOINTS ==========

    async getAllPlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const plans = await this.planService.getAllPlans();
            reply.send(plans);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch plans" });
        }
    }

    async getPlanByType(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { type } = req.params as { type: string };
            const plan = await this.planService.getPlanByType(
                type as SubscriptionType
            );

            if (!plan) {
                reply.code(404).send({ message: "Plan not found" });
                return;
            }

            reply.send(plan);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch plan" });
        }
    }

    async getFeaturedPricing(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const pricing = await this.planService.getFeaturedPricing();
            reply.send(pricing);
        } catch (error: any) {
            reply
                .code(500)
                .send({
                    message: error.message || "Failed to fetch featured pricing",
                });
        }
    }

    async comparePlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const comparison = await this.planService.comparePlans();
            reply.send(comparison);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to compare plans" });
        }
    }

    // ========== ADMIN ENDPOINTS ==========

    async getAllPlansAdmin(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const plans = await this.planService.getAllPlans(true); // Include inactive
            reply.send(plans);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch plans" });
        }
    }

    async getPlanById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const plan = await this.planService.getPlanById(id);

            if (!plan) {
                reply.code(404).send({ message: "Plan not found" });
                return;
            }

            reply.send(plan);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch plan" });
        }
    }

    async createPlan(req: FastifyRequest, reply: FastifyReply) {
        try {
            const planData = req.body as ICreateSubscriptionPlanDTO;
            const plan = await this.planService.createPlan(planData);
            reply.code(201).send(plan);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to create plan" });
        }
    }

    async updatePlan(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const updateData = req.body as IUpdateSubscriptionPlanDTO;
            const plan = await this.planService.updatePlan(id, updateData);
            reply.send(plan);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to update plan" });
        }
    }

    async deletePlan(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            await this.planService.deletePlan(id);
            reply.code(204).send();
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to delete plan" });
        }
    }

    async seedPlans(_req: FastifyRequest, reply: FastifyReply) {
        try {
            await this.planService.seedDefaultPlans();
            reply.send({ message: "Default plans seeded successfully" });
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to seed plans" });
        }
    }
}
