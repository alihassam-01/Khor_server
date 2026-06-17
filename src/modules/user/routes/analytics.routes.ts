import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controller/analytics.controller";
import { RATE_LIMITS } from "@config/rate-limit.config";
import { authenticate } from "@middlewares/authenticate";

export default async function analyticsRoutes(fastify: FastifyInstance) {
    const controller = new AnalyticsController();

    // Batch endpoint for optimized tracking
    fastify.post(
        "/analytics/batch",
        { config: { rateLimit: RATE_LIMITS.analyticsIngest } },
        controller.trackBatch,
    );
    
    // Get stats for a specific ad
    fastify.get<{ Params: { adId: string } }>(
        "/analytics/stats/:adId",
        { preHandler: authenticate },
        controller.getStats,
    );

    // Get stats for a vendor
    fastify.get<{
        Params: { vendorId: string };
        Querystring: { startDate?: string; endDate?: string; listingType?: string };
    }>(
        "/analytics/vendor/:vendorId",
        { preHandler: authenticate },
        controller.getVendorStats,
    );
}
