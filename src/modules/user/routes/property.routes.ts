import { FastifyInstance } from "fastify";
import { PropertyController } from "../controller/property.controller";
import { AdsController } from "../controller/ads.controller";
import { authenticate } from "@middlewares/authenticate";
import { ICreateProperty } from "../dtos/property.dto";
import { IGetAdsByVendorParams } from "../types/ads.types";

export default async function propertyRoutes(fastify: FastifyInstance) {
    const propertyController = new PropertyController();
    const adsController = new AdsController();

    // Generic property routes for vendor dashboard compatibility
    fastify.post<{ Body: ICreateProperty }>(
        "/properties", 
        { preHandler: authenticate }, 
        propertyController.createProperty.bind(propertyController)
    );

    fastify.get<{ Params: IGetAdsByVendorParams }>(
        "/properties/vendor/:vendorId", 
        { preHandler: authenticate }, 
        adsController.getAdsByVendor.bind(adsController)
    );
}
