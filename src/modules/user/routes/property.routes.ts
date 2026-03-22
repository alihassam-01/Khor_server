import { FastifyInstance } from "fastify";
import { PropertyController } from "../controller/property.controller";
import { AdsController } from "../controller/ads.controller";
import { authenticate } from "@middlewares/authenticate";

export default async function propertyRoutes(fastify: FastifyInstance) {
    const propertyController = new PropertyController();

    // Generic property routes for vendor dashboard compatibility
    fastify.post("/properties", {
        preHandler: authenticate
    }, propertyController.createProperty.bind(propertyController));

    fastify.get("/properties/vendor/:vendorId", {
        preHandler: authenticate
    }, new AdsController().getAdsByVendor.bind(new AdsController()));
}
