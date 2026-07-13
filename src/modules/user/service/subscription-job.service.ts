import { AppDataSource } from "@config/ormconfig";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";
import { ListingStatus, ListingSubscriptionStatus, ListingType } from "@common/enums/listing.enums";
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
 * Cron-style scanner over `vendor_subscriptions`. Finds business subscriptions
 * about to expire (and already expired) and notifies the vendor account.
 *
 * Replaces the previous Hotel/Restaurant-specific job — both types now flow
 * through the unified vendor billing model, so a single scan covers the
 * hotel's associated restaurant too.
 */
export class SubscriptionJobService {
    private subRepo = AppDataSource.getRepository(VendorSubscription);
    private listingRepo = AppDataSource.getRepository(Listing);
    private emailService = new SendEmail();
    private notificationOutboxService = new NotificationOutboxService();

    private async loadPrimaryListing(vendorId: string): Promise<Listing | null> {
        const rows = await this.listingRepo.find({
            where: [
                { vendor_id: vendorId, type: ListingType.HOTEL },
                { vendor_id: vendorId, type: ListingType.RESTAURANT },
            ],
            relations: ["contact"],
            order: {
                is_active: "DESC",
                created_at: "ASC",
            },
            take: 2,
        });
        return rows[0] ?? null;
    }

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
            if (!sub.vendor_id || !sub.next_due_date) continue;
            const listing = await this.loadPrimaryListing(sub.vendor_id);
            const username = sub.vendor?.profile?.username || "Vendor";
            const dueDateLabel = sub.next_due_date.toLocaleDateString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
            });
            const dueMonth = sub.next_due_date.toLocaleDateString("en-PK", { month: "long" });
            const dueKey = sub.next_due_date.toISOString().slice(0, 10);
            const businessName = listing?.name
                || sub.vendor?.profile?.business_name
                || sub.vendor?.profile?.username
                || "Your business";

            if (sub.vendor?.email) {
                await this.emailService
                    .sendSubscriptionPaymentReminderEmail({
                        to: sub.vendor.email,
                        recipientName: username,
                        businessName,
                        dueMonth,
                        dueDateLabel,
                        metadata: {
                            listingId: listing?.id ?? sub.vendor_id,
                            dueDate: dueKey,
                            listingType: listing?.type ?? ListingType.HOTEL,
                        },
                    })
                    .catch((e) =>
                        logError(e, `Failed subscription payment reminder email for vendor ${sub.vendor_id}`),
                    );
            }

            if (sub.vendor_id) {
                await this.notificationOutboxService
                    .enqueueSubscriptionPaymentReminder({
                        manager: AppDataSource.manager,
                        userId: sub.vendor_id,
                        listingId: listing?.id ?? sub.vendor_id,
                        phoneNumber: sub.vendor?.profile?.phone_number
                            ?? listing?.contact?.whatsapp
                            ?? listing?.contact?.phone,
                        ownerName: username,
                        businessName,
                        dueMonth,
                        dueDate: dueDateLabel,
                        dueKey,
                    })
                    .catch((e) =>
                        logError(e, `Failed subscription payment reminder WhatsApp enqueue for vendor ${sub.vendor_id}`),
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
            if (!sub.vendor_id) continue;
            const listing = await this.loadPrimaryListing(sub.vendor_id);

            sub.status = ListingSubscriptionStatus.EXPIRED;
            await this.subRepo.save(sub);
            await this.listingRepo.createQueryBuilder()
                .update(Listing)
                .set({ is_active: false, status: ListingStatus.INACTIVE })
                .where("vendor_id = :vendorId", { vendorId: sub.vendor_id })
                .execute();

            if (sub.vendor?.email && sub.expires_at) {
                const username = sub.vendor.profile?.username || "Vendor";
                const businessName = listing?.name
                    || sub.vendor.profile?.business_name
                    || sub.vendor.profile?.username
                    || "Your business";
                const adType = TYPE_LABEL[listing?.type ?? ListingType.HOTEL] ?? "Listing";
                await this.emailService
                    .sendAdExpiredEmail(
                        username,
                        sub.vendor.email,
                        businessName,
                        adType,
                        sub.expires_at,
                    )
                    .catch((e) =>
                        logError(e, `Failed expiration notice for vendor ${sub.vendor_id}`),
                    );
            }
        }
    }
}
