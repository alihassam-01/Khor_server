import { AppDataSource } from "@config/ormconfig";
import { User } from "@modules/user/entity/user/user.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { AdAnalytics } from "@modules/user/entity/payment/ad-analytics.entity";
import { AnalyticsEventType } from "@common/enums/analytics.enums";
import { ListingType } from "@common/enums/listing.enums";
import { UserRole } from "@common/enums/user.enums";
import { SendEmail } from "@modules/user/service/email/sendEmail";
import { logInfo, logError } from "@lib/logger";

const TYPE_LABEL: Record<ListingType, string> = {
    [ListingType.HOTEL]: "Hotel",
    [ListingType.RESTAURANT]: "Restaurant",
    [ListingType.TOUR]: "Tour",
    [ListingType.VEHICLE]: "Vehicle",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Periodic job that emails each vendor a summary of their listing
 * performance over the last N days. Walks the unified `listings` +
 * `ad_analytics` tables — one path for every listing type.
 */
export class AnalyticsJobService {
    private userRepository = AppDataSource.getRepository(User);
    private listingRepository = AppDataSource.getRepository(Listing);
    private analyticsRepository = AppDataSource.getRepository(AdAnalytics);
    private emailService = new SendEmail();

    async generateAndSendReports(days: number = 7): Promise<void> {
        logInfo(`Starting analytics report generation for the last ${days} days...`);

        const now = new Date();
        const startDate = new Date(now.getTime() - days * DAY_MS);
        const reportType = days === 1 ? "Daily" : days === 7 ? "Weekly" : "Monthly";
        const period = `${reportType} Report (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;

        try {
            const vendors = await this.userRepository.find({
                where: { userType: UserRole.VENDOR },
                relations: ["profile"],
            });

            for (const vendorUser of vendors) {
                const listings = await this.listingRepository.find({
                    where: { vendor_id: vendorUser.id },
                });

                if (listings.length === 0) continue;

                const adsStats: Array<{
                    name: string;
                    type: string;
                    views: number;
                    clicks: number;
                    unique_visitors: number;
                    ctr: string;
                }> = [];

                for (const ad of listings) {
                    const stats = await this.analyticsRepository
                        .createQueryBuilder("analytics")
                        .select("analytics.event_type", "type")
                        .addSelect("COUNT(*)", "count")
                        .where("analytics.listing_id = :adId", { adId: ad.id })
                        .andWhere("analytics.created_at BETWEEN :start AND :end", {
                            start: startDate,
                            end: now,
                        })
                        .groupBy("analytics.event_type")
                        .getRawMany();

                    const uniqueVisitors = await this.analyticsRepository
                        .createQueryBuilder("analytics")
                        .select("COUNT(DISTINCT analytics.ip_hash)", "count")
                        .where("analytics.listing_id = :adId", { adId: ad.id })
                        .andWhere("analytics.created_at BETWEEN :start AND :end", {
                            start: startDate,
                            end: now,
                        })
                        .getRawOne();

                    const formatted = stats.reduce(
                        (acc, curr) => {
                            acc[curr.type] = parseInt(curr.count);
                            return acc;
                        },
                        { [AnalyticsEventType.VIEW]: 0, [AnalyticsEventType.CLICK]: 0 } as Record<string, number>,
                    );

                    const views = formatted[AnalyticsEventType.VIEW] || 0;
                    const clicks = formatted[AnalyticsEventType.CLICK] || 0;
                    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : "0.00";

                    adsStats.push({
                        name: ad.name,
                        type: TYPE_LABEL[ad.type] ?? "Listing",
                        views,
                        clicks,
                        unique_visitors: parseInt(uniqueVisitors?.count || "0"),
                        ctr,
                    });
                }

                const vendorName =
                    vendorUser.profile?.username || vendorUser.email.split("@")[0];
                await this.emailService.sendAnalyticsReportEmail(
                    vendorName,
                    vendorUser.email,
                    period,
                    adsStats,
                );
            }

            logInfo("Analytics report generation completed successfully.");
        } catch (error) {
            logError(error as Error, "Failed to generate analytics reports");
        }
    }
}
