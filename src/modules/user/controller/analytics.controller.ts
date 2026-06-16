import { FastifyRequest, FastifyReply } from "fastify";
import { AnalyticsService, AnalyticsBatchItem } from "@modules/user/service/analytics.service";
import { ListingType } from "@common/enums/listing.enums";
import crypto from "crypto";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { UserRole } from "@common/enums/user.enums";

import { logInfo, logError } from "@lib/logger";

export class AnalyticsController {
    private analyticsService = new AnalyticsService();

    private getActor(request: FastifyRequest): { userId: string; userType: UserRole } {
        const user = (request.user ?? {}) as {
            id?: string;
            userId?: string;
            userType?: UserRole;
        };
        const userId = user.id || user.userId;
        if (!userId || !user.userType) {
            throw new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED);
        }
        return { userId, userType: user.userType };
    }

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
        const actor = this.getActor(request);
        
        if (!adId) {
            throw new AppError("Ad ID is required", 400, ErrorCodes.BAD_REQUEST);
        }

        const stats = await this.analyticsService.getAdStats(adId, actor);
        reply.send(stats);
    }
    getVendorStats = async (request: FastifyRequest<{ Params: { vendorId: string }, Querystring: { startDate?: string, endDate?: string, listingType?: string } }>, reply: FastifyReply) => {
        const { vendorId } = request.params;
        const { startDate, endDate, listingType } = request.query;
        const actor = this.getActor(request);
        
        if (!vendorId) {
            throw new AppError("Vendor ID is required", 400, ErrorCodes.BAD_REQUEST);
        }
        if (actor.userType !== UserRole.ADMIN && actor.userId !== vendorId) {
            throw new AppError("You cannot access another vendor's analytics", 403, ErrorCodes.FORBIDDEN);
        }

        const normalizedListingType = listingType && Object.values(ListingType).includes(listingType as ListingType)
            ? (listingType as ListingType)
            : undefined;

        const stats = await this.analyticsService.getVendorAnalytics(
            vendorId,
            startDate,
            endDate,
            undefined,
            normalizedListingType,
        );
        reply.send(stats);
    }
}
