import { EntityManager, LessThanOrEqual, MoreThan } from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingSubscription } from "@modules/user/entity/listing/listing-subscription.entity";
import { SubscriptionPlan } from "@modules/user/entity/subscription-plan.entity";
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
import {
    FEATURED_AD_PRICE,
    SUBSCRIPTION_DURATION_DAYS,
} from "@common/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Resolved details of a "buy this plan" action. */
export interface IPlanResolution {
    plan: SubscriptionPlan | null;
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
        em: EntityManager,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<IPlanResolution> {
        const planRepo = em.getRepository(SubscriptionPlan);
        let plan: SubscriptionPlan | null = null;

        if (opts.plan_id) {
            plan = await planRepo.findOne({ where: { plan_id: opts.plan_id } });
        }
        if (!plan && opts.subscription_type) {
            // `subscription_type` may be a SubscriptionType enum value or a UUID
            const candidate = String(opts.subscription_type);
            if (candidate.length > 20) {
                plan = await planRepo.findOne({ where: { plan_id: candidate } });
            } else {
                plan = await planRepo.findOne({
                    where: { type: candidate as SubscriptionType },
                });
            }
        }

        const type = (plan?.type as SubscriptionType)
            ?? (opts.subscription_type as SubscriptionType)
            ?? SubscriptionType.FREE;
        const duration_days = plan ? plan.duration_days : this.daysFor(type);
        const base_amount = plan ? Number(plan.price) : 0;

        let featured_amount = 0;
        if (opts.is_featured) {
            const featuredPlan = await planRepo.findOne({
                where: { type: "featured" as SubscriptionType },
            });
            featured_amount = featuredPlan ? Number(featuredPlan.price) : FEATURED_AD_PRICE;
        }

        return {
            plan,
            type,
            duration_days,
            base_amount,
            featured_amount,
            total_amount: base_amount + featured_amount,
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
            plan_id?: string | null;
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
        sub.plan_id = resolution.plan?.plan_id ?? null;
        sub.subscription_type = resolution.type;
        sub.is_featured = !!opts.is_featured;
        sub.amount = resolution.total_amount;

        if (isFreeOrZero) {
            sub.status = ListingSubscriptionStatus.ACTIVE;
            sub.is_paid = true;
            sub.started_at = new Date();
            sub.expires_at = new Date(Date.now() + resolution.duration_days * DAY_MS);
        } else {
            sub.status = ListingSubscriptionStatus.PENDING;
            sub.is_paid = false;
            sub.started_at = null;
            sub.expires_at = null;
        }

        const saved = await subRepo.save(sub);

        let payment: AdPayment | null = null;
        if (!isFreeOrZero && listing.vendor_id) {
            const payRepo = em.getRepository(AdPayment);
            payment = new AdPayment();
            payment.listing_id = listing.id;
            payment.subscription_id = saved.id;
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
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            duration_days?: number;
        } = {},
    ): Promise<ListingSubscription | null> {
        const subRepo = em.getRepository(ListingSubscription);
        const current = await this.getCurrent(em, listing.id);

        const now = new Date();
        let durationDays = opts.duration_days;
        if (durationDays == null) {
            if (opts.plan_id) {
                const plan = await em.getRepository(SubscriptionPlan).findOne({
                    where: { plan_id: opts.plan_id },
                });
                durationDays = plan?.duration_days ?? this.daysFor(opts.subscription_type ?? current?.subscription_type);
            } else {
                durationDays = this.daysFor(opts.subscription_type ?? current?.subscription_type);
            }
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
        sub.expires_at = new Date(baseDate.getTime() + durationDays * DAY_MS);
        sub.started_at = sub.started_at ?? now;
        sub.status = ListingSubscriptionStatus.ACTIVE;
        sub.is_paid = true;
        if (opts.plan_id) sub.plan_id = opts.plan_id;
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
