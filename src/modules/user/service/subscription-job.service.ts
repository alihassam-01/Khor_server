import { AppDataSource } from "@config/ormconfig";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingSubscription } from "@modules/user/entity/listing/listing-subscription.entity";
import { ListingSubscriptionStatus, ListingType } from "@common/enums/listing.enums";
import { SendEmail } from "@modules/user/service/email/sendEmail";
import { logInfo, logError } from "@lib/logger";
import { And, LessThan, MoreThanOrEqual } from "typeorm";

const TYPE_LABEL: Record<ListingType, string> = {
    [ListingType.HOTEL]: "Hotel",
    [ListingType.RESTAURANT]: "Restaurant",
    [ListingType.TOUR]: "Tour",
    [ListingType.VEHICLE]: "Vehicle",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cron-style scanner over `listing_subscriptions`. Finds subscription periods
 * about to expire (and already expired) and notifies the listing's vendor.
 *
 * Replaces the previous Hotel/Restaurant-specific job — both types now flow
 * through the unified `listings` + `listing_subscriptions` tables, so a single
 * scan handles every listing type.
 */
export class SubscriptionJobService {
    private subRepo = AppDataSource.getRepository(ListingSubscription);
    private listingRepo = AppDataSource.getRepository(Listing);
    private emailService = new SendEmail();

    async checkExpirations(): Promise<void> {
        logInfo("Checking for ad expirations and warnings...");
        try {
            await this.processWarnings();
            await this.processExpired();
            logInfo("Ad expiration check completed.");
        } catch (error) {
            logError(error as Error, "Failed to check ad expirations");
        }
    }

    private async processWarnings(): Promise<void> {
        const now = new Date();
        const twoDaysFromNow = new Date(now.getTime() + 2 * DAY_MS);
        const threeDaysFromNow = new Date(now.getTime() + 3 * DAY_MS);

        const upcoming = await this.subRepo.find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: And(MoreThanOrEqual(twoDaysFromNow), LessThan(threeDaysFromNow)),
            },
            relations: [
                "listing",
                "listing.vendor",
                "listing.vendor.profile",
            ],
        });

        for (const sub of upcoming) {
            const listing = sub.listing;
            if (!listing?.vendor?.email || !sub.expires_at) continue;
            const username = listing.vendor.profile?.username || "Vendor";
            const adType = TYPE_LABEL[listing.type] ?? "Listing";
            await this.emailService
                .sendAdExpirationWarningEmail(
                    username,
                    listing.vendor.email,
                    listing.name,
                    adType,
                    sub.expires_at,
                    2,
                )
                .catch((e) =>
                    logError(e, `Failed expiration warning for ${listing.type}: ${listing.name}`),
                );
        }
    }

    private async processExpired(): Promise<void> {
        const now = new Date();
        const yesterday = new Date(now.getTime() - DAY_MS);

        const expired = await this.subRepo.find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: And(MoreThanOrEqual(yesterday), LessThan(now)),
            },
            relations: [
                "listing",
                "listing.vendor",
                "listing.vendor.profile",
            ],
        });

        for (const sub of expired) {
            const listing = sub.listing;
            if (!listing) continue;

            sub.status = ListingSubscriptionStatus.EXPIRED;
            await this.subRepo.save(sub);
            listing.is_active = false;
            await this.listingRepo.save(listing);

            if (listing.vendor?.email && sub.expires_at) {
                const username = listing.vendor.profile?.username || "Vendor";
                const adType = TYPE_LABEL[listing.type] ?? "Listing";
                await this.emailService
                    .sendAdExpiredEmail(
                        username,
                        listing.vendor.email,
                        listing.name,
                        adType,
                        sub.expires_at,
                    )
                    .catch((e) =>
                        logError(e, `Failed expiration notice for ${listing.type}: ${listing.name}`),
                    );
            }
        }
    }
}
