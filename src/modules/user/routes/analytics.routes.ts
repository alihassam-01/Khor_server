import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controller/analytics.controller";

export default async function analyticsRoutes(fastify: FastifyInstance) {
    const controller = new AnalyticsController();

    // Batch endpoint for optimized tracking
    fastify.post("/analytics/batch", controller.trackBatch);
    
    // Get stats for a specific ad
    fastify.get("/analytics/stats/:adId", controller.getStats);

    // Get stats for a vendor
    fastify.get("/analytics/vendor/:vendorId", controller.getVendorStats);
}
