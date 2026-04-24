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
    async getVendorAnalytics(vendorId: string, startDate?: string, endDate?: string, timezone?: string) {
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
                // Include the full end date in UTC
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
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
            // If a user timezone is provided (IANA name, e.g. "Asia/Karachi"), group by the
            // user's local calendar day so chart buckets match what the user sees on their
            // clock. Falls back to plain UTC DATE() when no timezone is supplied.
            const tz = timezone || 'UTC';
            const dateTruncExpr = `(analytics.created_at AT TIME ZONE 'UTC' AT TIME ZONE :tz)::date`;
            const timeSeriesQuery = queryBuilder.clone()
                .select(dateTruncExpr, "date")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .setParameter("tz", tz)
                .groupBy(dateTruncExpr)
                .addGroupBy("analytics.event_type")
                .orderBy(dateTruncExpr, "ASC");
            
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
            // Using a fresh query builder to avoid any inherited state from previous clones
            const adStatsResult = await this.analyticsRepository.createQueryBuilder("analytics")
                .select("analytics.ad_id", "adId")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .where("analytics.ad_id IN (:...adIds)", { adIds })
                .groupBy("analytics.ad_id")
                .addGroupBy("analytics.event_type")
                .getRawMany();

            // Ensure we use unique ads to prevent duplicate entries in the breakdown table
            const uniqueAds = Array.from(new Map(ads.map(ad => [ad.id, ad])).values());

            const adsWithStats = uniqueAds.map(ad => {
                // Find stats for this specific ad
                // We check multiple potential result keys because TypeORM's getRawMany 
                // can vary based on driver/naming strategies
                const adStats = adStatsResult.filter(s => {
                    const rowAdId = s.adId || s.ad_id || s.analytics_ad_id || s.analytics_adId;
                    return String(rowAdId) === String(ad.id);
                });
                
                const viewsRow = adStats.find(s => (s.type || s.analytics_event_type) === AnalyticsEventType.VIEW);
                const clicksRow = adStats.find(s => (s.type || s.analytics_event_type) === AnalyticsEventType.CLICK);
                
                const views = viewsRow ? parseInt(String(viewsRow.count)) : 0;
                const clicks = clicksRow ? parseInt(String(clicksRow.count)) : 0;
                
                // Determine status - checking common active flag naming patterns
                const isActive = (ad as any).active || (ad as any).is_active;
                const status = isActive ? 'active' : 'pending_approval';

                return {
                    id: ad.id,
                    name: ad.name,
                    type: ad.type,
                    status: status,
                    views,
                    clicks
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
