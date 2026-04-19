import { AppDataSource } from "@config/ormconfig";
import { AdAnalytics } from "../entity/ads/ad-analytics.entity";
import { AnalyticsEventType } from "../entity/ENUM/enum";
import { AdType } from "../entity/ENUM/ad.enum";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logError } from "@lib/logger";

export interface AnalyticsBatchItem {
    adId: string;
    adType: AdType;
    type: AnalyticsEventType;
    timestamp: number;
}

export class AnalyticsService {
    private analyticsRepository = AppDataSource.getRepository(AdAnalytics);

    async saveBatch(events: AnalyticsBatchItem[], ipHash?: string): Promise<void> {
        if (!events || events.length === 0) return;

        let analyticsEntities: any[] = [];
        try {
            analyticsEntities = events.map(event => ({
                ad_id: event.adId,
                ad_type: event.adType,
                event_type: event.type,
                ip_hash: ipHash,
                created_at: new Date(event.timestamp)
            }));

            // Optimized bulk insertion
            await this.analyticsRepository.insert(analyticsEntities);
        } catch (error) {
            logError(error as Error, `Analytics batch save failed. Data: ${JSON.stringify(analyticsEntities)}`);
            throw new AppError("Failed to process analytics batch", 500, ErrorCodes.ANALYTICS_FAILED);
        }
    }

    async getAdStats(adId: string) {
        try {
            const stats = await this.analyticsRepository
                .createQueryBuilder("analytics")
                .select("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .where("analytics.ad_id = :adId", { adId })
                .groupBy("analytics.event_type")
                .getRawMany();

            const uniqueVisitors = await this.analyticsRepository
                .createQueryBuilder("analytics")
                .select("COUNT(DISTINCT analytics.ip_hash)", "count")
                .where("analytics.ad_id = :adId", { adId })
                .getRawOne();

            const formattedStats = stats.reduce((acc, curr) => {
                acc[curr.type] = parseInt(curr.count);
                return acc;
            }, { view: 0, click: 0 });

            return {
                ...formattedStats,
                unique_visitors: parseInt(uniqueVisitors?.count || "0")
            };
        } catch (error) {
            logError(error as Error, "Failed to fetch ad stats");
            throw new AppError("Failed to retrieve analytics data", 500, ErrorCodes.ANALYTICS_FAILED);
        }
    }
}
