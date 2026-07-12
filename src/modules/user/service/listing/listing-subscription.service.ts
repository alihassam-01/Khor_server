import { EntityManager, LessThanOrEqual, MoreThan } from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingSubscription } from "@modules/user/entity/listing/listing-subscription.entity";
import { AdPayment } from "@modules/user/entity/payment/ad-payment.entity";
import {
    ListingStatus,
    ListingSubscriptionStatus,
} from "@common/enums/listing.enums";
import {
    PaymentMethod,
    PaymentStatus,
} from "@common/enums/payment.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import {
    FEATURED_AD_PRICE,
    SUBSCRIPTION_DURATION_DAYS,
} from "@common/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolved details of a "buy this plan" action. */
export interface IPlanResolution {
    type: SubscriptionType;
    duration_days: number;
    base_amount: number;
    featured_amount: number;
    total_amount: number;
}

/**
 * Manages `listing_subscriptions` rows. Each row is one subscription period
 * for a listing. The "current" period is the most recently created row.
 *
 * Replaces all the duplicated `expires_at`/`is_paid`/`subscription_type` logic
 * that used to live on the Hotel and Restaurant entities.
 */
export class ListingSubscriptionService {
    private parseDateInput(value?: string | Date | null): Date | null {
        if (!value) return null;
        const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private advanceCycle(
        date: Date,
        type?: SubscriptionType | string | null,
        explicitDurationDays?: number,
    ): Date {
        const next = new Date(date.getTime());
        if (explicitDurationDays && (type == null || String(type).toLowerCase() === SubscriptionType.FREE)) {
            next.setDate(next.getDate() + explicitDurationDays);
            return next;
        }
        switch (String(type ?? SubscriptionType.MONTHLY).toLowerCase()) {
            case SubscriptionType.YEARLY:
                next.setFullYear(next.getFullYear() + 1);
                return next;
            case SubscriptionType.QUARTERLY:
                next.setMonth(next.getMonth() + 3);
                return next;
            case SubscriptionType.FREE:
                next.setDate(next.getDate() + this.daysFor(type));
                return next;
            case SubscriptionType.MONTHLY:
            default:
                next.setMonth(next.getMonth() + 1);
                return next;
        }
    }

    /** Most-recent subscription row for a listing, regardless of status. */
    async getCurrent(
        em: EntityManager,
        listingId: string,
    ): Promise<ListingSubscription | null> {
        return em.getRepository(ListingSubscription).findOne({
            where: { listing_id: listingId },
            order: { created_at: "DESC" },
        });
    }

    /** Most-recent ACTIVE subscription row, or null if none. */
    async getActive(
        em: EntityManager,
        listingId: string,
    ): Promise<ListingSubscription | null> {
        return em.getRepository(ListingSubscription).findOne({
            where: { listing_id: listingId, status: ListingSubscriptionStatus.ACTIVE },
            order: { created_at: "DESC" },
        });
    }

    /** Convert a `SubscriptionType` to a duration in days (with fallback). */
    daysFor(type?: SubscriptionType | string | null): number {
        if (!type) return 30;
        const key = String(type).toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        return SUBSCRIPTION_DURATION_DAYS[key] ?? 30;
    }

    /**
     * Resolve a target plan by id (preferred) or type. Computes the total
     * amount that would be charged, optionally adding the featured uplift.
     */
    async resolvePlan(
        _em: EntityManager,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<IPlanResolution> {
        let finalType = SubscriptionType.FREE;
        const duration_days = this.daysFor(finalType);
        let base_amount = 0;

        if (opts.subscription_type) {
            const up = String(opts.subscription_type).toUpperCase();
            if (Object.values(SubscriptionType).includes(up as any) || Object.values(SubscriptionType).includes(opts.subscription_type as any)) {
                finalType = (up === SubscriptionType.FREE.toUpperCase() ? SubscriptionType.FREE :
                             up === SubscriptionType.MONTHLY.toUpperCase() ? SubscriptionType.MONTHLY :
                             up === SubscriptionType.QUARTERLY.toUpperCase() ? SubscriptionType.QUARTERLY :
                             up === SubscriptionType.YEARLY.toUpperCase() ? SubscriptionType.YEARLY :
                             SubscriptionType.FREE);
            }
        }

        const featured_amount = opts.is_featured ? FEATURED_AD_PRICE : 0;
        const total_amount = base_amount + featured_amount;

        return {
            type: finalType,
            duration_days,
            base_amount,
            featured_amount,
            total_amount,
        };
    }

    /**
     * Open a brand-new subscription period for `listing` and (if the period
     * costs money) create a corresponding pending AdPayment intent. Used on
     * listing creation and on vendor-initiated renewal.
     */
    async openPeriod(
        em: EntityManager,
        listing: Listing,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<{ subscription: ListingSubscription; payment: AdPayment | null; resolution: IPlanResolution }> {
        const resolution = await this.resolvePlan(em, opts);

        const isFree = resolution.type === SubscriptionType.FREE && !opts.is_featured;
        const isFreeOrZero = isFree || resolution.total_amount <= 0;

        const subRepo = em.getRepository(ListingSubscription);
        const sub = new ListingSubscription();
        sub.listing_id = listing.id;
        sub.subscription_type = resolution.type;
        sub.is_featured = !!opts.is_featured;
        sub.amount = resolution.total_amount;

        if (isFreeOrZero) {
            const startedAt = new Date();
            const nextDueDate = this.advanceCycle(startedAt, resolution.type, resolution.duration_days);
            sub.status = ListingSubscriptionStatus.ACTIVE;
            sub.is_paid = true;
            sub.started_at = startedAt;
            sub.paid_at = startedAt;
            sub.next_due_date = nextDueDate;
            sub.expires_at = nextDueDate;
        } else {
            sub.status = ListingSubscriptionStatus.PENDING;
            sub.is_paid = false;
            sub.started_at = null;
            sub.paid_at = null;
            sub.next_due_date = null;
            sub.expires_at = null;
        }

        const saved = await subRepo.save(sub);

        let payment: AdPayment | null = null;
        if (!isFreeOrZero && listing.vendor_id) {
            const payRepo = em.getRepository(AdPayment);
            payment = new AdPayment();
            payment.listing_id = listing.id;
            payment.vendor_subscription_id = null;
            payment.vendor_id = listing.vendor_id;
            payment.amount = resolution.total_amount;
            payment.payment_method = PaymentMethod.BANK_TRANSFER;
            payment.transaction_id = "PENDING_APPROVAL";
            payment.notes = `Auto-generated payment intent for ${listing.type}: ${listing.name}`;
            payment.payment_status = PaymentStatus.PENDING;
            payment = await payRepo.save(payment);

            saved.payment_id = payment.payment_id;
            await subRepo.save(saved);
        }

        return { subscription: saved, payment, resolution };
    }

    /**
     * Mark the most recent subscription period as ACTIVE and bump the
     * listing's denormalized `status` / `is_active` flag. Idempotent: if
     * already active, just refreshes the listing flags.
     */
    async activate(
        em: EntityManager,
        listing: Listing,
        opts: {
            subscription_type?: SubscriptionType | string | null;
            duration_days?: number;
        } = {},
    ): Promise<ListingSubscription | null> {
        const subRepo = em.getRepository(ListingSubscription);
        const current = await this.getCurrent(em, listing.id);

        const now = new Date();
        let durationDays = opts.duration_days;
        if (durationDays == null) {
            durationDays = this.daysFor(opts.subscription_type ?? current?.subscription_type);
        }

        let sub: ListingSubscription;
        if (!current) {
            sub = new ListingSubscription();
            sub.listing_id = listing.id;
            sub.subscription_type = (opts.subscription_type as SubscriptionType) ?? SubscriptionType.FREE;
        } else {
            sub = current;
        }

        const baseDate = sub.expires_at && sub.expires_at > now ? sub.expires_at : now;
        const nextDueDate = this.advanceCycle(
            baseDate,
            opts.subscription_type ?? sub.subscription_type,
            durationDays,
        );
        sub.expires_at = nextDueDate;
        sub.started_at = sub.started_at ?? now;
        sub.paid_at = now;
        sub.next_due_date = nextDueDate;
        sub.status = ListingSubscriptionStatus.ACTIVE;
        sub.is_paid = true;
        if (opts.subscription_type) sub.subscription_type = opts.subscription_type as SubscriptionType;

        await subRepo.save(sub);

        listing.status = ListingStatus.ACTIVE;
        listing.is_active = true;
        await em.getRepository(Listing).save(listing);
        return sub;
    }

    /**
     * Mark the listing's most-recent subscription as expired/cancelled and
     * flip the listing flags off.
     */
    async deactivate(em: EntityManager, listing: Listing): Promise<void> {
        const subRepo = em.getRepository(ListingSubscription);
        const current = await this.getCurrent(em, listing.id);
        if (current && current.status === ListingSubscriptionStatus.ACTIVE) {
            current.status = ListingSubscriptionStatus.CANCELLED;
            await subRepo.save(current);
        }
        listing.status = ListingStatus.INACTIVE;
        listing.is_active = false;
        await em.getRepository(Listing).save(listing);
    }

    async markPaid(
        em: EntityManager,
        listing: Listing,
        opts: {
            paid_at?: string | Date | null;
            next_due_date?: string | Date | null;
            grace_period_days?: number;
        } = {},
    ): Promise<ListingSubscription> {
        const subRepo = em.getRepository(ListingSubscription);
        const now = new Date();
        const current = await this.getCurrent(em, listing.id);

        const sub = current ?? new ListingSubscription();
        if (!current) {
            sub.listing_id = listing.id;
            sub.subscription_type = SubscriptionType.MONTHLY;
            sub.status = ListingSubscriptionStatus.PENDING;
            sub.is_paid = false;
            sub.amount = 0;
            sub.is_featured = listing.is_featured;
        }

        const paidAt = this.parseDateInput(opts.paid_at) ?? now;
        const overrideDueDate = this.parseDateInput(opts.next_due_date);
        const currentDueDate = this.parseDateInput(sub.next_due_date ?? sub.expires_at ?? null) ?? paidAt;
        const nextDueDate = overrideDueDate ?? this.advanceCycle(currentDueDate, sub.subscription_type);

        if (opts.grace_period_days !== undefined) {
            if (!Number.isInteger(opts.grace_period_days) || opts.grace_period_days < 0) {
                throw new AppError(
                    "grace_period_days must be a non-negative integer",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }
            sub.grace_period_days = opts.grace_period_days;
        } else if (!sub.grace_period_days && sub.grace_period_days !== 0) {
            sub.grace_period_days = 7;
        }

        sub.started_at = sub.started_at ?? paidAt;
        sub.paid_at = paidAt;
        sub.next_due_date = nextDueDate;
        sub.expires_at = nextDueDate;
        sub.status = ListingSubscriptionStatus.ACTIVE;
        sub.is_paid = true;

        const saved = await subRepo.save(sub);

        listing.status = ListingStatus.ACTIVE;
        listing.is_active = true;
        await em.getRepository(Listing).save(listing);

        return saved;
    }

    /**
     * Find listings whose current subscription expires within the next
     * `days` days (used by the warning email job).
     */
    async findExpiringSoon(
        em: EntityManager,
        days: number,
    ): Promise<ListingSubscription[]> {
        const now = new Date();
        const horizon = new Date(now.getTime() + days * DAY_MS);
        return em.getRepository(ListingSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: MoreThan(now),
            },
            relations: ["listing"],
            order: { expires_at: "ASC" },
        }).then((rows) => rows.filter((r) => r.expires_at && r.expires_at <= horizon));
    }

    /** Listings whose subscription has already expired but is still ACTIVE. */
    async findExpired(em: EntityManager): Promise<ListingSubscription[]> {
        const now = new Date();
        return em.getRepository(ListingSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: LessThanOrEqual(now),
            },
            relations: ["listing"],
            order: { expires_at: "ASC" },
        });
    }
}
