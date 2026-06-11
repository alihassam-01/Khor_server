import { AppDataSource } from "@config/ormconfig";
import { AdAnalytics } from "@modules/user/entity/payment/ad-analytics.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { AnalyticsEventType } from "@common/enums/analytics.enums";
import { ListingType } from "@common/enums/listing.enums";
import { PropertyType } from "@common/enums/property.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logError } from "@lib/logger";

/**
 * Externally we still accept `adType` as the legacy `PropertyType` string
 * for backward-compat with the analytics tracker beacon; internally we
 * normalize to `ListingType`.
 */
export type AdType = PropertyType;

export interface AnalyticsBatchItem {
    adId: string;
    adType: AdType;
    type: AnalyticsEventType;
    timestamp: number;
}

const propertyTypeToListingType: Partial<Record<PropertyType, ListingType>> = {
    [PropertyType.HOTEL]: ListingType.HOTEL,
    [PropertyType.RESTAURANT]: ListingType.RESTAURANT,
    [PropertyType.TOUR]: ListingType.TOUR,
    [PropertyType.VEHICLE]: ListingType.VEHICLE,
    [PropertyType.CAR_RENTAL]: ListingType.VEHICLE,
};

export class AnalyticsService {
    private analyticsRepository = AppDataSource.getRepository(AdAnalytics);
    private listingRepository = AppDataSource.getRepository(Listing);

    async saveBatch(events: AnalyticsBatchItem[], ipHash?: string): Promise<void> {
        if (!events || events.length === 0) return;

        let analyticsEntities: Array<{
            listing_id: string;
            listing_type: ListingType;
            event_type: AnalyticsEventType;
            ip_hash?: string;
            created_at: Date;
        }> = [];
        try {
            analyticsEntities = events.map((event) => ({
                listing_id: event.adId,
                listing_type:
                    propertyTypeToListingType[event.adType] ?? ListingType.HOTEL,
                event_type: event.type,
                ip_hash: ipHash,
                created_at: new Date(event.timestamp),
            }));

            await this.analyticsRepository.insert(analyticsEntities as any);
        } catch (error) {
            logError(
                error as Error,
                `Analytics batch save failed. Data: ${JSON.stringify(analyticsEntities)}`,
            );
            throw new AppError(
                "Failed to process analytics batch",
                500,
                ErrorCodes.ANALYTICS_FAILED,
            );
        }
    }

    async getAdStats(adId: string) {
        try {
            const stats = await this.analyticsRepository
                .createQueryBuilder("analytics")
                .select("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .where("analytics.listing_id = :adId", { adId })
                .groupBy("analytics.event_type")
                .getRawMany();

            const uniqueVisitors = await this.analyticsRepository
                .createQueryBuilder("analytics")
                .select("COUNT(DISTINCT analytics.ip_hash)", "count")
                .where("analytics.listing_id = :adId", { adId })
                .getRawOne();

            const formattedStats = stats.reduce(
                (acc, curr) => {
                    acc[curr.type] = parseInt(curr.count);
                    return acc;
                },
                { [AnalyticsEventType.VIEW]: 0, [AnalyticsEventType.CLICK]: 0 } as Record<string, number>,
            );

            return {
                ...formattedStats,
                unique_visitors: parseInt(uniqueVisitors?.count || "0"),
            };
        } catch (error) {
            logError(error as Error, "Failed to fetch ad stats");
            throw new AppError(
                "Failed to retrieve analytics data",
                500,
                ErrorCodes.ANALYTICS_FAILED,
            );
        }
    }

    async getVendorAnalytics(
        vendorId: string,
        startDate?: string,
        endDate?: string,
        timezone?: string,
        listingType?: ListingType,
    ) {
        try {
            const ads = await this.listingRepository.find({
                where: {
                    vendor_id: vendorId,
                    ...(listingType ? { type: listingType } : {}),
                },
                relations: ["subscriptions"],
            });

            const adIds = ads.map((ad) => ad.id);
            const now = new Date();

            const history = {
                totalAds: ads.length,
                activeAds: ads.filter((ad) => ad.is_active).length,
                pendingAds: ads.filter((ad) => {
                    if (ad.is_active) return false;
                    const sub = ad.subscriptions?.[0];
                    return sub && !sub.is_paid;
                }).length,
                expiredAds: ads.filter((ad) => {
                    const sub = ad.subscriptions?.[0];
                    return sub?.expires_at && new Date(sub.expires_at) < now;
                }).length,
            };

            if (adIds.length === 0) {
                return {
                    history,
                    metrics: { totalViews: 0, totalClicks: 0 },
                    charts: [],
                    ads: [],
                };
            }

            const queryBuilder = this.analyticsRepository
                .createQueryBuilder("analytics")
                .where("analytics.listing_id IN (:...adIds)", { adIds });

            if (startDate) {
                queryBuilder.andWhere("analytics.created_at >= :startDate", {
                    startDate: new Date(startDate),
                });
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setUTCHours(23, 59, 59, 999);
                queryBuilder.andWhere("analytics.created_at <= :endDate", { endDate: end });
            }

            const totalsQuery = queryBuilder
                .clone()
                .select("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .groupBy("analytics.event_type");
            const totalsResult = await totalsQuery.getRawMany();

            const metrics = totalsResult.reduce(
                (acc, curr) => {
                    if (curr.type === AnalyticsEventType.VIEW) acc.totalViews = parseInt(curr.count);
                    if (curr.type === AnalyticsEventType.CLICK) acc.totalClicks = parseInt(curr.count);
                    return acc;
                },
                { totalViews: 0, totalClicks: 0 },
            );

            const tz = timezone || "UTC";
            const dateTruncExpr = `(analytics.created_at AT TIME ZONE 'UTC' AT TIME ZONE :tz)::date`;
            const timeSeriesQuery = queryBuilder
                .clone()
                .select(dateTruncExpr, "date")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .setParameter("tz", tz)
                .groupBy(dateTruncExpr)
                .addGroupBy("analytics.event_type")
                .orderBy(dateTruncExpr, "ASC");

            const timeSeriesResult = await timeSeriesQuery.getRawMany();

            const chartsMap = new Map<string, { date: string; views: number; clicks: number }>();
            timeSeriesResult.forEach((row) => {
                const dateStr =
                    row.date instanceof Date ? row.date.toISOString().split("T")[0] : String(row.date);
                if (!chartsMap.has(dateStr)) {
                    chartsMap.set(dateStr, { date: dateStr, views: 0, clicks: 0 });
                }
                const entry = chartsMap.get(dateStr)!;
                if (row.type === AnalyticsEventType.VIEW) entry.views = parseInt(row.count);
                if (row.type === AnalyticsEventType.CLICK) entry.clicks = parseInt(row.count);
            });

            const charts = Array.from(chartsMap.values());

            const adStatsResult = await this.analyticsRepository
                .createQueryBuilder("analytics")
                .select("analytics.listing_id", "adId")
                .addSelect("analytics.event_type", "type")
                .addSelect("COUNT(*)", "count")
                .where("analytics.listing_id IN (:...adIds)", { adIds })
                .groupBy("analytics.listing_id")
                .addGroupBy("analytics.event_type")
                .getRawMany();

            const uniqueAds = Array.from(new Map(ads.map((ad) => [ad.id, ad])).values());

            const adsWithStats = uniqueAds.map((ad) => {
                const adStats = adStatsResult.filter((s) => {
                    const rowAdId = s.adId || s.listing_id || s.analytics_listing_id;
                    return String(rowAdId) === String(ad.id);
                });

                const viewsRow = adStats.find(
                    (s) => (s.type || s.analytics_event_type) === AnalyticsEventType.VIEW,
                );
                const clicksRow = adStats.find(
                    (s) => (s.type || s.analytics_event_type) === AnalyticsEventType.CLICK,
                );

                const views = viewsRow ? parseInt(String(viewsRow.count)) : 0;
                const clicks = clicksRow ? parseInt(String(clicksRow.count)) : 0;

                const status = ad.is_active ? "active" : "pending_approval";

                return {
                    id: ad.id,
                    name: ad.name,
                    type: ad.type,
                    status,
                    views,
                    clicks,
                };
            });

            return {
                history,
                metrics,
                charts,
                ads: adsWithStats,
            };
        } catch (error) {
            logError(error as Error, "Failed to fetch vendor analytics");
            throw new AppError(
                "Failed to retrieve vendor analytics",
                500,
                ErrorCodes.ANALYTICS_FAILED,
            );
        }
    }
}
