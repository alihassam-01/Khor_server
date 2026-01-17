import { FastifyInstance } from "fastify";
import { AdsController } from "../controller/ads.controller";

export async function adsRoutes(fastify: FastifyInstance) {
    const adsController = new AdsController();

    // Public route to get ads by location
    fastify.get(
        "/ads/location/:location_id",
        adsController.getAdsByLocation.bind(adsController)
    );
}
