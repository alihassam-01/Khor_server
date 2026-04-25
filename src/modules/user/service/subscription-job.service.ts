import { AppDataSource } from "@config/ormconfig";
import { Hotel, Restaurant } from "@entity/ads";
import { SendEmail } from "@modules/user/service/email/sendEmail";
import { logInfo, logError } from "@lib/logger";
import { LessThan, MoreThanOrEqual, And } from "typeorm";

export class SubscriptionJobService {
    private hotelRepository = AppDataSource.getRepository(Hotel);
    private restaurantRepository = AppDataSource.getRepository(Restaurant);
    private emailService = new SendEmail();

    async checkExpirations() {
        logInfo("Checking for ad expirations and warnings...");
        
        try {
            await this.processHotelExpirations();
            await this.processRestaurantExpirations();
            
            logInfo("Ad expiration check completed.");
        } catch (error) {
            logError(error as Error, "Failed to check ad expirations");
        }
    }

    private async processHotelExpirations() {
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        // 1. Check for warnings (exactly 2 days left)
        const hotelsWarning = await this.hotelRepository.find({
            where: {
                is_active: true,
                expires_at: And(MoreThanOrEqual(twoDaysFromNow), LessThan(threeDaysFromNow))
            },
            relations: ["vendor", "vendor.vendor", "vendor.customerProfile"]
        });

        for (const hotel of hotelsWarning) {
            if (hotel.vendor?.email) {
                await this.emailService.sendAdExpirationWarningEmail(
                    hotel.vendor?.customerProfile?.username || hotel.vendor?.vendor?.username || "Vendor",
                    hotel.vendor.email,
                    hotel.name,
                    "Hotel",
                    hotel.expires_at!,
                    2
                ).catch(e => logError(e, `Failed to send expiration warning for Hotel: ${hotel.name}`));
            }
        }

        // 2. Check for expired ads (just expired today)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const hotelsExpired = await this.hotelRepository.find({
            where: {
                is_active: true,
                expires_at: And(MoreThanOrEqual(yesterday), LessThan(now))
            },
            relations: ["vendor", "vendor.vendor", "vendor.customerProfile"]
        });

        for (const hotel of hotelsExpired) {
            hotel.is_active = false;
            await this.hotelRepository.save(hotel);

            if (hotel.vendor?.email) {
                await this.emailService.sendAdExpiredEmail(
                    hotel.vendor?.customerProfile?.username || hotel.vendor?.vendor?.username || "Vendor",
                    hotel.vendor.email,
                    hotel.name,
                    "Hotel",
                    hotel.expires_at!
                ).catch(e => logError(e, `Failed to send expiration notice for Hotel: ${hotel.name}`));
            }
        }
    }

    private async processRestaurantExpirations() {
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        // 1. Check for warnings
        const restaurantsWarning = await this.restaurantRepository.find({
            where: {
                is_active: true,
                expires_at: And(MoreThanOrEqual(twoDaysFromNow), LessThan(threeDaysFromNow))
            },
            relations: ["vendor", "vendor.vendor", "vendor.customerProfile"]
        });

        for (const rest of restaurantsWarning) {
            if (rest.vendor?.email) {
                await this.emailService.sendAdExpirationWarningEmail(
                    rest.vendor?.customerProfile?.username || rest.vendor?.vendor?.username || "Vendor",
                    rest.vendor.email,
                    rest.name,
                    "Restaurant",
                    rest.expires_at!,
                    2
                ).catch(e => logError(e, `Failed to send expiration warning for Restaurant: ${rest.name}`));
            }
        }

        // 2. Check for expired ads
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const restaurantsExpired = await this.restaurantRepository.find({
            where: {
                is_active: true,
                expires_at: And(MoreThanOrEqual(yesterday), LessThan(now))
            },
            relations: ["vendor", "vendor.vendor", "vendor.customerProfile"]
        });

        for (const rest of restaurantsExpired) {
            rest.is_active = false;
            await this.restaurantRepository.save(rest);

            if (rest.vendor?.email) {
                await this.emailService.sendAdExpiredEmail(
                    rest.vendor?.customerProfile?.username || rest.vendor?.vendor?.username || "Vendor",
                    rest.vendor.email,
                    rest.name,
                    "Restaurant",
                    rest.expires_at!
                ).catch(e => logError(e, `Failed to send expiration notice for Restaurant: ${rest.name}`));
            }
        }
    }
}
