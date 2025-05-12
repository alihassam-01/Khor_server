import { FastifyInstance } from "fastify";
import { BusinessService } from "../service/business.service";
import { BusinessController } from "../controller/business.controller";

export default async function BusinessRoutes(fastify: FastifyInstance) {
    const businessService = new BusinessService();
    const businessController = new BusinessController(businessService);

    fastify.post("/create/business-type",businessController.createBusinessType.bind(businessController));
    fastify.post("/create/business",businessController.createBusiness.bind(businessController));

}
