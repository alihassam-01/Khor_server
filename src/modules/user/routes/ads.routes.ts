import { FastifyInstance } from "fastify";
import { AdsController } from "@modules/user/controller/ads.controller";

export async function adsRoutes(fastify: FastifyInstance) {
    const adsController = new AdsController();

    // Public route to get ads by location
    fastify.get(
        "/ads/location/:location_id",
        adsController.getAdsByLocation.bind(adsController)
    );

    // Public route to get combined hotels and restaurants with pagination and search
    fastify.get(
        "/ads/hotel-restaurant",
        adsController.getCombinedAds.bind(adsController)
    );

    // New public promoted-listings surface. This intentionally excludes hotels
    // so booking inventory can evolve independently from ad/promotion flows.
    fastify.get(
        "/promoted-listings",
        adsController.getPromotedListings.bind(adsController)
    );
}
