import { FastifyRequest, FastifyReply } from "fastify";
import { AnalyticsService, AnalyticsBatchItem } from "@modules/user/service/analytics.service";
import crypto from "crypto";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

import { logInfo, logError } from "@lib/logger";

export class AnalyticsController {
    private analyticsService = new AnalyticsService();

    trackBatch = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const events = request.body as AnalyticsBatchItem[];
            logInfo(`Analytics batch received: ${events?.length} events from ${request.ip}`);
            
            if (!events || !Array.isArray(events)) {
                throw new AppError("Invalid analytics batch format", 400, ErrorCodes.BAD_REQUEST);
            }

            // Simple IP hashing to identify unique users without storing PII
            const ip = request.ip;
            const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

            await this.analyticsService.saveBatch(events, ipHash);
            reply.code(204).send();
        } catch (error) {
            logError(error as Error, "Controller: Analytics batch failed");
            throw error;
        }
    }

    getStats = async (request: FastifyRequest<{ Params: { adId: string } }>, reply: FastifyReply) => {
        const { adId } = request.params;
        
        if (!adId) {
            throw new AppError("Ad ID is required", 400, ErrorCodes.BAD_REQUEST);
        }

        const stats = await this.analyticsService.getAdStats(adId);
        reply.send(stats);
    }
}
