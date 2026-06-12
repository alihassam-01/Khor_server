import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { AdminListingsController } from "@modules/user/controller/admin-listings.controller";
import { AdminListingsService } from "@modules/user/service/admin-listings.service";
import { IUpdateListingVisibilityDto } from "@modules/user/types/admin-listings.types";

export default async function adminListingsRoutes(fastify: FastifyInstance) {
    const service = new AdminListingsService();
    const controller = new AdminListingsController(service);
    const preHandler = [authenticate, authorizeAdmin];

    fastify.get("/admin/listings", { preHandler }, controller.listListings.bind(controller));
    fastify.patch<{ Params: { id: string }; Body: IUpdateListingVisibilityDto }>(
        "/admin/listings/:id/public-visibility",
        { preHandler },
        controller.updatePublicVisibility.bind(controller),
    );
}
