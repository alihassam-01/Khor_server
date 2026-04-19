import { AppDataSource } from "@config/ormconfig";
import { User } from "../entity/user/user.entity";
import { Hotel, Restaurant } from "../entity/ads";
import { AdAnalytics } from "../entity/ads/ad-analytics.entity";
import { SendEmail } from "./email/sendEmail";
import { logInfo, logError } from "@lib/logger";

export class AnalyticsJobService {
    private userRepository = AppDataSource.getRepository(User);
    private hotelRepository = AppDataSource.getRepository(Hotel);
    private restaurantRepository = AppDataSource.getRepository(Restaurant);
    private analyticsRepository = AppDataSource.getRepository(AdAnalytics);
    private emailService = new SendEmail();

    async generateAndSendReports(days: number = 7) {
        logInfo(`Starting analytics report generation for the last ${days} days...`);
        
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const reportType = days === 1 ? "Daily" : days === 7 ? "Weekly" : "Monthly";
        const period = `${reportType} Report (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`;

        try {
            // 1. Get all users who are vendors
            const vendors = await this.userRepository.find({
                where: { userType: 'vendor' as any },
                relations: ["vendor"]
            });

            for (const vendorUser of vendors) {
                // 2. Get ads for this vendor
                const hotels = await this.hotelRepository.find({ where: { vendor_id: vendorUser.id } });
                const restaurants = await this.restaurantRepository.find({ where: { vendor_id: vendorUser.id } });
                
                const allAds = [
                    ...hotels.map(h => ({ id: h.id, name: h.name, type: 'Hotel' })),
                    ...restaurants.map(r => ({ id: r.id, name: r.name, type: 'Restaurant' }))
                ];

                if (allAds.length === 0) continue;

                const adsStats = [];

                // 3. Collect stats for each ad
                for (const ad of allAds) {
                    const stats = await this.analyticsRepository
                        .createQueryBuilder("analytics")
                        .select("analytics.event_type", "type")
                        .addSelect("COUNT(*)", "count")
                        .where("analytics.ad_id = :adId", { adId: ad.id })
                        .andWhere("analytics.created_at BETWEEN :start AND :end", { 
                            start: startDate, 
                            end: now 
                        })
                        .groupBy("analytics.event_type")
                        .getRawMany();

                    const uniqueVisitors = await this.analyticsRepository
                        .createQueryBuilder("analytics")
                        .select("COUNT(DISTINCT analytics.ip_hash)", "count")
                        .where("analytics.ad_id = :adId", { adId: ad.id })
                        .andWhere("analytics.created_at BETWEEN :start AND :end", { 
                            start: startDate, 
                            end: now 
                        })
                        .getRawOne();

                    const formatted = stats.reduce((acc, curr) => {
                        acc[curr.type] = parseInt(curr.count);
                        return acc;
                    }, { view: 0, click: 0 });

                    const views = formatted.view || 0;
                    const clicks = formatted.click || 0;
                    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : "0.00";

                    adsStats.push({
                        name: ad.name,
                        type: ad.type,
                        views,
                        clicks,
                        unique_visitors: parseInt(uniqueVisitors?.count || "0"),
                        ctr
                    });
                }

                // 4. Send email
                const vendorName = vendorUser.vendor?.username || vendorUser.email.split('@')[0];
                await this.emailService.sendAnalyticsReportEmail(
                    vendorName,
                    vendorUser.email,
                    period,
                    adsStats
                );
                
                logInfo(`Sent weekly report to vendor: ${vendorUser.email}`);
            }
            
            logInfo("Weekly analytics report generation completed successfully.");
        } catch (error) {
            logError(error as Error, "Failed to generate weekly analytics reports");
        }
    }
}
