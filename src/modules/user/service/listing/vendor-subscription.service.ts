import { EntityManager, LessThanOrEqual, MoreThan } from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { AdPayment } from "@modules/user/entity/payment/ad-payment.entity";
import { SubscriptionPlan } from "@modules/user/entity/subscription-plan.entity";
import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";
import {
    ListingStatus,
    ListingSubscriptionStatus,
} from "@common/enums/listing.enums";
import {
    PaymentMethod,
    PaymentStatus,
} from "@common/enums/payment.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { FEATURED_AD_PRICE, SUBSCRIPTION_DURATION_DAYS } from "@common/constants";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IPlanResolution {
    plan: SubscriptionPlan | null;
    type: SubscriptionType;
    duration_days: number;
    base_amount: number;
    featured_amount: number;
    total_amount: number;
}

export class VendorSubscriptionService {
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

    private async setVendorListingsActive(
        em: EntityManager,
        vendorId: string,
        isActive: boolean,
    ): Promise<void> {
        const status = isActive ? ListingStatus.ACTIVE : ListingStatus.INACTIVE;
        await em.getRepository(Listing).createQueryBuilder()
            .update(Listing)
            .set({ is_active: isActive, status })
            .where("vendor_id = :vendorId", { vendorId })
            .execute();
    }

    async getCurrent(
        em: EntityManager,
        vendorId: string,
    ): Promise<VendorSubscription | null> {
        return em.getRepository(VendorSubscription).findOne({
            where: { vendor_id: vendorId },
        });
    }

    daysFor(type?: SubscriptionType | string | null): number {
        if (!type) return 30;
        const key = String(type).toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        return SUBSCRIPTION_DURATION_DAYS[key] ?? 30;
    }

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

    async ensureForListing(
        em: EntityManager,
        listing: Listing,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;

        const existing = await this.getCurrent(em, listing.vendor_id);
        if (existing) {
            return existing;
        }

        return this.openOrRefresh(em, listing, opts, { createPaymentIntent: true });
    }

    private async openOrRefresh(
        em: EntityManager,
        listing: Listing,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
            duration_days?: number;
        },
        behavior: {
            createPaymentIntent: boolean;
            paid_at?: string | Date | null;
            next_due_date?: string | Date | null;
            forceActive?: boolean;
            grace_period_days?: number;
        } = { createPaymentIntent: false },
    ): Promise<VendorSubscription> {
        if (!listing.vendor_id) {
            throw new AppError("Listing does not belong to a vendor", 400, ErrorCodes.BAD_REQUEST);
        }

        const repo = em.getRepository(VendorSubscription);
        const current = await this.getCurrent(em, listing.vendor_id);
        const resolution = await this.resolvePlan(em, opts);

        const sub = current ?? new VendorSubscription();
        if (!current) {
            sub.vendor_id = listing.vendor_id;
            sub.grace_period_days = 7;
        }

        sub.plan_id = resolution.plan?.plan_id ?? opts.plan_id ?? sub.plan_id ?? null;
        sub.subscription_type = resolution.type;
        sub.is_featured = !!opts.is_featured;
        sub.amount = resolution.total_amount;

        const paidAt = this.parseDateInput(behavior.paid_at) ?? new Date();
        const overrideDueDate = this.parseDateInput(behavior.next_due_date);
        const baseDate = this.parseDateInput(sub.next_due_date ?? sub.expires_at ?? null) ?? paidAt;
        const nextDueDate = overrideDueDate ?? this.advanceCycle(
            sub.expires_at && sub.expires_at > paidAt ? sub.expires_at : baseDate,
            resolution.type,
            opts.duration_days ?? resolution.duration_days,
        );

        const isFreeOrZero = resolution.total_amount <= 0 || (resolution.type === SubscriptionType.FREE && !opts.is_featured);
        const shouldActivate = behavior.forceActive === true || isFreeOrZero;

        if (behavior.grace_period_days !== undefined) {
            if (!Number.isInteger(behavior.grace_period_days) || behavior.grace_period_days < 0) {
                throw new AppError("grace_period_days must be a non-negative integer", 400, ErrorCodes.VALIDATION_ERROR);
            }
            sub.grace_period_days = behavior.grace_period_days;
        }

        if (shouldActivate) {
            sub.started_at = sub.started_at ?? paidAt;
            sub.paid_at = paidAt;
            sub.next_due_date = nextDueDate;
            sub.expires_at = nextDueDate;
            sub.status = ListingSubscriptionStatus.ACTIVE;
            sub.is_paid = true;
        } else {
            sub.status = ListingSubscriptionStatus.PENDING;
            sub.is_paid = false;
        }

        const saved = await repo.save(sub);

        if (behavior.createPaymentIntent && !shouldActivate) {
            const payment = new AdPayment();
            payment.listing_id = listing.id;
            payment.vendor_id = listing.vendor_id;
            payment.vendor_subscription_id = saved.id;
            payment.amount = resolution.total_amount;
            payment.payment_method = PaymentMethod.BANK_TRANSFER;
            payment.transaction_id = "PENDING_APPROVAL";
            payment.notes = `Auto-generated payment intent for ${listing.type}: ${listing.name}`;
            payment.payment_status = PaymentStatus.PENDING;
            const createdPayment = await em.getRepository(AdPayment).save(payment);
            saved.payment_id = createdPayment.payment_id;
            await repo.save(saved);
        }

        if (shouldActivate) {
            await this.setVendorListingsActive(em, listing.vendor_id, true);
        }

        return saved;
    }

    async activate(
        em: EntityManager,
        listing: Listing,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            duration_days?: number;
        } = {},
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;
        return this.openOrRefresh(
            em,
            listing,
            {
                plan_id: opts.plan_id ?? null,
                subscription_type: opts.subscription_type ?? null,
                is_featured: listing.is_featured,
                duration_days: opts.duration_days,
            },
            {
                createPaymentIntent: false,
                forceActive: true,
            },
        );
    }

    async openPeriod(
        em: EntityManager,
        listing: Listing,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
            is_featured?: boolean;
        },
    ): Promise<{ subscription: VendorSubscription | null; payment: AdPayment | null; resolution: IPlanResolution }> {
        const resolution = await this.resolvePlan(em, opts);
        if (!listing.vendor_id) {
            return { subscription: null, payment: null, resolution };
        }

        const subscription = await this.openOrRefresh(
            em,
            listing,
            {
                plan_id: opts.plan_id ?? null,
                subscription_type: opts.subscription_type ?? null,
                is_featured: opts.is_featured,
            },
            { createPaymentIntent: true },
        );

        let payment: AdPayment | null = null;
        if (subscription.payment_id) {
            payment = await em.getRepository(AdPayment).findOne({
                where: { payment_id: subscription.payment_id },
            });
        }

        return { subscription, payment, resolution };
    }

    async deactivate(em: EntityManager, listing: Listing): Promise<void> {
        if (!listing.vendor_id) return;
        const current = await this.getCurrent(em, listing.vendor_id);
        if (current && current.status === ListingSubscriptionStatus.ACTIVE) {
            current.status = ListingSubscriptionStatus.CANCELLED;
            await em.getRepository(VendorSubscription).save(current);
        }
        await this.setVendorListingsActive(em, listing.vendor_id, false);
    }

    async markPaid(
        em: EntityManager,
        listing: Listing,
        opts: {
            paid_at?: string | Date | null;
            next_due_date?: string | Date | null;
            grace_period_days?: number;
        } = {},
    ): Promise<VendorSubscription> {
        return this.openOrRefresh(
            em,
            listing,
            {
                plan_id: null,
                subscription_type: undefined,
                is_featured: listing.is_featured,
            },
            {
                createPaymentIntent: false,
                paid_at: opts.paid_at,
                next_due_date: opts.next_due_date,
                grace_period_days: opts.grace_period_days,
                forceActive: true,
            },
        );
    }

    async updateCurrentPlan(
        em: EntityManager,
        listing: Listing,
        opts: {
            plan_id?: string | null;
            subscription_type?: SubscriptionType | string | null;
        },
    ): Promise<VendorSubscription | null> {
        if (!listing.vendor_id) return null;
        const current = await this.getCurrent(em, listing.vendor_id);
        if (!current) return null;
        if (opts.plan_id !== undefined) current.plan_id = opts.plan_id ?? null;
        if (opts.subscription_type !== undefined) {
            current.subscription_type = opts.subscription_type as SubscriptionType;
        }
        return em.getRepository(VendorSubscription).save(current);
    }

    async findExpiringSoon(
        em: EntityManager,
        days: number,
    ): Promise<VendorSubscription[]> {
        const now = new Date();
        const horizon = new Date(now.getTime() + days * DAY_MS);
        return em.getRepository(VendorSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: MoreThan(now),
            },
            relations: ["vendor", "vendor.profile"],
            order: { expires_at: "ASC" },
        }).then((rows) => rows.filter((row) => row.expires_at && row.expires_at <= horizon));
    }

    async findExpired(em: EntityManager): Promise<VendorSubscription[]> {
        const now = new Date();
        return em.getRepository(VendorSubscription).find({
            where: {
                status: ListingSubscriptionStatus.ACTIVE,
                expires_at: LessThanOrEqual(now),
            },
            relations: ["vendor", "vendor.profile"],
            order: { expires_at: "ASC" },
        });
    }
}
