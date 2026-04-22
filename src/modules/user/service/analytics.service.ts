import { AppDataSource } from "@config/ormconfig";
import { AdAnalytics } from "@entity/ads/ad-analytics.entity";
import { AnalyticsEventType } from "@entity/ENUM/enum";
import { AdType } from "@entity/ENUM/ad.enum";
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
            }, { [AnalyticsEventType.VIEW]: 0, [AnalyticsEventType.CLICK]: 0 });

            return {
                ...formattedStats,
                unique_visitors: parseInt(uniqueVisitors?.count || "0")
            };
        } catch (error) {
            logError(error as Error, "Failed to fetch ad stats");
            throw new AppError("Failed to retrieve analytics data", 500, ErrorCodes.ANALYTICS_FAILED);
        }
    }
    async getVendorAnalytics(vendorId: string, startDate?: string, endDate?: string) {
        try {
            const { AdsService } = await import("./ads.service");
            const adsService = new AdsService();
            const ads = await adsService.getAdsByVendor(vendorId);

            const adIds = ads.map(ad => ad.id);

            const history = {
                totalAds: ads.length,
                activeAds: ads.filter(ad => (ad as any).is_active || (ad as any).active).length,
                pendingAds: ads.filter(ad => !(ad as any).is_active && !(ad as any).is_paid && (ad as any).subscription_type !== 'free').length,
                expiredAds: ads.filter(ad => (ad as any).expires_at && new Date((ad as any).expires_at) < new Date()).length
            };

            if (adIds.length === 0) {
                return {
                    history,
                    metrics: { totalViews: 0, totalClicks: 0 },
                    charts: [],
                    ads: []
                };
            }

            const queryBuilder = this.analyticsRepository.createQueryBuilder("analytics")
                .where("analytics.ad_id IN (:...adIds)", { adIds });

            if (startDate) {
                queryBuilder.andWhere("analytics.created_at >= :startDate", { startDate: new Date(startDate) });
            }
            if (endDate) {
                // To include the end date fully
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                queryBuilder.andWhere("analytics.created_at <= :endDate", { endDate: end });
            }

            // Get total metrics
            const totalsQuery = queryBuilder.clone()
                .select("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .groupBy("analytics.event_type");
            const totalsResult = await totalsQuery.getRawMany();

            const metrics = totalsResult.reduce((acc, curr) => {
                if (curr.type === AnalyticsEventType.VIEW) acc.totalViews = parseInt(curr.count);
                if (curr.type === AnalyticsEventType.CLICK) acc.totalClicks = parseInt(curr.count);
                return acc;
            }, { totalViews: 0, totalClicks: 0 });

            // Time series (charts)
            // Note: Postgres DATE() or TO_CHAR might be needed depending on DB. Assuming Postgres syntax `DATE(created_at)`.
            const timeSeriesQuery = queryBuilder.clone()
                .select("DATE(analytics.created_at)", "date")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .groupBy("DATE(analytics.created_at)")
                .addGroupBy("analytics.event_type")
                .orderBy("DATE(analytics.created_at)", "ASC");
            
            const timeSeriesResult = await timeSeriesQuery.getRawMany();

            const chartsMap = new Map<string, { date: string, views: number, clicks: number }>();
            timeSeriesResult.forEach(row => {
                const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date);
                if (!chartsMap.has(dateStr)) {
                    chartsMap.set(dateStr, { date: dateStr, views: 0, clicks: 0 });
                }
                const entry = chartsMap.get(dateStr)!;
                if (row.type === AnalyticsEventType.VIEW) entry.views = parseInt(row.count);
                if (row.type === AnalyticsEventType.CLICK) entry.clicks = parseInt(row.count);
            });

            const charts = Array.from(chartsMap.values());

            // Ad level metrics
            const adStatsQuery = queryBuilder.clone()
                .select("analytics.ad_id", "ad_id")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .groupBy("analytics.ad_id")
                .addGroupBy("analytics.event_type");
            
            const adStatsResult = await adStatsQuery.getRawMany();

            const adsWithStats = ads.map(ad => {
                const adStats = adStatsResult.filter(s => String(s.ad_id || s.analytics_ad_id) === String(ad.id));
                const views = adStats.find(s => (s.type || s.analytics_event_type) === AnalyticsEventType.VIEW)?.count || 0;
                const clicks = adStats.find(s => (s.type || s.analytics_event_type) === AnalyticsEventType.CLICK)?.count || 0;
                return {
                    id: ad.id,
                    name: ad.name,
                    type: ad.type,
                    status: (ad as any).status || "unknown",
                    views: parseInt(String(views)),
                    clicks: parseInt(String(clicks))
                };
            });

            return {
                history,
                metrics,
                charts,
                ads: adsWithStats
            };
        } catch (error) {
            logError(error as Error, "Failed to fetch vendor analytics");
            throw new AppError("Failed to retrieve vendor analytics", 500, ErrorCodes.ANALYTICS_FAILED);
        }
    }
}
