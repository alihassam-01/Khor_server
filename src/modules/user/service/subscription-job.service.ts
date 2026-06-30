import { AppDataSource } from "@config/ormconfig";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingSubscription } from "@modules/user/entity/listing/listing-subscription.entity";
import { ListingSubscriptionStatus, ListingType } from "@common/enums/listing.enums";
import { SendEmail } from "@modules/user/service/email/sendEmail";
import { NotificationOutboxService } from "@modules/user/service/notification-outbox.service";
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
    private notificationOutboxService = new NotificationOutboxService();

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
                next_due_date: And(MoreThanOrEqual(twoDaysFromNow), LessThan(threeDaysFromNow)),
            },
            relations: [
                "listing",
                "listing.contact",
                "listing.vendor",
                "listing.vendor.profile",
            ],
        });

        for (const sub of upcoming) {
            const listing = sub.listing;
            if (!listing || !sub.next_due_date) continue;
            const username = listing.vendor?.profile?.username || "Vendor";
            const dueDateLabel = sub.next_due_date.toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
            const dueMonth = sub.next_due_date.toLocaleDateString("en-PK", { month: "long" });
            const dueKey = sub.next_due_date.toISOString().slice(0, 10);

            if (listing.vendor?.email) {
                await this.emailService
                    .sendSubscriptionPaymentReminderEmail({
                        to: listing.vendor.email,
                        recipientName: username,
                        businessName: listing.name,
                        dueMonth,
                        dueDateLabel,
                        metadata: {
                            listingId: listing.id,
                            dueDate: dueKey,
                            listingType: listing.type,
                        },
                    })
                    .catch((e) =>
                        logError(e, `Failed subscription payment reminder email for ${listing.type}: ${listing.name}`),
                    );
            }

            if (listing.vendor_id) {
                await this.notificationOutboxService
                    .enqueueSubscriptionPaymentReminder({
                        manager: AppDataSource.manager,
                        userId: listing.vendor_id,
                        listingId: listing.id,
                        phoneNumber: listing.vendor?.profile?.phone_number
                            ?? listing.contact?.whatsapp
                            ?? listing.contact?.phone,
                        ownerName: username,
                        businessName: listing.name,
                        dueMonth,
                        dueDate: dueDateLabel,
                        dueKey,
                    })
                    .catch((e) =>
                        logError(e, `Failed subscription payment reminder WhatsApp enqueue for ${listing.type}: ${listing.name}`),
                    );
            }
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
