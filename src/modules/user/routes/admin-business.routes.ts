import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { BusinessCapabilityType } from "@common/enums/business.enums";
import { AdminBusinessReviewController } from "@modules/user/controller/admin-business-review.controller";
import { AdminBusinessReviewService } from "@modules/user/service/admin-business-review.service";
import {
    IReviewBusinessCapabilityDto,
    IReviewBusinessProfileDto,
} from "@modules/user/types/admin-business-review.types";

export default async function adminBusinessRoutes(fastify: FastifyInstance) {
    const service = new AdminBusinessReviewService();
    const controller = new AdminBusinessReviewController(service);
    const preHandler = [authenticate, authorizeAdmin];

    fastify.get("/admin/businesses", { preHandler }, controller.listBusinesses.bind(controller));
    fastify.get<{ Params: { id: string } }>(
        "/admin/businesses/:id",
        { preHandler },
        controller.getBusiness.bind(controller),
    );
    fastify.patch<{ Params: { id: string }; Body: IReviewBusinessProfileDto }>(
        "/admin/businesses/:id/profile-review",
        { preHandler },
        controller.reviewProfile.bind(controller),
    );
    fastify.patch<{ Params: { id: string; capabilityType: BusinessCapabilityType }; Body: IReviewBusinessCapabilityDto }>(
        "/admin/businesses/:id/capabilities/:capabilityType/review",
        { preHandler },
        controller.reviewCapability.bind(controller),
    );
}
