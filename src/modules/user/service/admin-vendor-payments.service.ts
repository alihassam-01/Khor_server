import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";
import { VendorSubscriptionPayment } from "@modules/user/entity/payment/vendor-subscription-payment.entity";
import { BookingPayout } from "@modules/user/entity/booking/booking-payout.entity";
import { HotelBooking } from "@modules/user/entity/booking/hotel-booking.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { BookingSource, BookingPaymentStatus } from "@common/enums/booking.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { ListingSubscriptionStatus } from "@common/enums/listing.enums";
import { VendorSubscriptionService } from "@modules/user/service/listing/vendor-subscription.service";

export interface IRecordSubscriptionPaymentDto {
    vendor_id: string;
    amount: number;
    status: "pending" | "paid" | "waived";
    period_month: number;
    period_year: number;
    notes?: string;
}

export class AdminVendorPaymentsService {
    private vendorSubRepo = AppDataSource.getRepository(VendorSubscription);
    private vendorSubPaymentRepo = AppDataSource.getRepository(VendorSubscriptionPayment);
    private payoutRepo = AppDataSource.getRepository(BookingPayout);
    private bookingRepo = AppDataSource.getRepository(HotelBooking);
    private listingRepo = AppDataSource.getRepository(Listing);
    private vendorSubscriptionService = new VendorSubscriptionService();

    /**
     * Derives fee status for a vendor for a given month from the VendorSubscription row.
     * - FREE tier: always "n/a"
     * - MONTHLY tier: checks paid_at falls within the month
     */
    private deriveFeeStatus(
        sub: VendorSubscription,
        feeRecord: VendorSubscriptionPayment | null,
        month: number,
        year: number,
    ): "n/a" | "paid" | "waived" | "overdue" | "unpaid" {
        if (sub.subscription_type !== SubscriptionType.MONTHLY) {
            return "n/a";
        }

        // If admin recorded a payment for this specific period, use that
        if (feeRecord) {
            return feeRecord.status as "paid" | "waived";
        }

        // Derive from the vendor subscription's paid_at and next_due_date
        const now = new Date();
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

        const paidAt = sub.paid_at ? new Date(sub.paid_at) : null;
        const nextDueDate = sub.next_due_date ? new Date(sub.next_due_date) : null;

        // Paid within the selected month
        if (paidAt && paidAt >= monthStart && paidAt <= monthEnd) {
            return "paid";
        }

        // Subscription is still active and next_due_date is in the future
        if (sub.status === ListingSubscriptionStatus.ACTIVE && nextDueDate && nextDueDate > monthEnd) {
            // If the month we're viewing is in the past relative to now, and subscription was active, treat as paid
            if (monthEnd < now) {
                return "paid";
            }
        }

        // Subscription has expired / next_due_date has passed
        if (nextDueDate && nextDueDate < now) {
            return "overdue";
        }

        return "unpaid";
    }

    async getMonthlyOverview(month: number, year: number) {
        // Find all vendors (users with vendor_subscriptions)
        const vendorSubs = await this.vendorSubRepo.find({
            relations: ["vendor", "vendor.profile"],
        });

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const overview = [];

        for (const sub of vendorSubs) {
            const vendorId = sub.vendor_id;
            const vendorName = sub.vendor.profile?.business_name || sub.vendor.profile?.username || sub.vendor.email;

            // Get payouts for the month (commission tracking)
            const monthlyPayouts = await this.payoutRepo.createQueryBuilder("payout")
                .where("payout.vendor_id = :vendorId", { vendorId })
                .andWhere("payout.created_at >= :startDate", { startDate })
                .andWhere("payout.created_at <= :endDate", { endDate })
                .getMany();

            const totalCommission = monthlyPayouts.reduce((acc, p) => acc + Number(p.commission_amount || 0), 0);

            // Get total payouts all-time
            const allTimePayouts = await this.payoutRepo.createQueryBuilder("payout")
                .where("payout.vendor_id = :vendorId", { vendorId })
                .getMany();

            const totalPayout = allTimePayouts.reduce((acc, p) => acc + Number(p.amount || 0), 0);

            // Get web bookings revenue for the month
            const bookings = await this.bookingRepo.createQueryBuilder("booking")
                .innerJoin("booking.listing", "listing")
                .where("listing.vendor_id = :vendorId", { vendorId })
                .andWhere("booking.source = :source", { source: BookingSource.CUSTOMER_WEB })
                .andWhere("booking.payment_status IN (:...statuses)", {
                    statuses: [BookingPaymentStatus.PAID, BookingPaymentStatus.PARTIALLY_REFUNDED]
                })
                .andWhere("booking.created_at >= :startDate", { startDate })
                .andWhere("booking.created_at <= :endDate", { endDate })
                .getMany();

            const webRevenue = bookings.reduce((acc, b) => acc + Number(b.total_amount || 0), 0);

            // Check if admin has manually recorded a fee payment for this period
            const feeRecord = await this.vendorSubPaymentRepo.findOne({
                where: {
                    vendor_id: vendorId,
                    period_month: month,
                    period_year: year
                }
            });

            const feeStatus = this.deriveFeeStatus(sub, feeRecord, month, year);

            overview.push({
                vendorId,
                vendorName,
                subscriptionType: sub.subscription_type,
                subscriptionStatus: sub.status,
                paidAt: sub.paid_at ?? null,
                nextDueDate: sub.next_due_date ?? null,
                webRevenue: Number(webRevenue.toFixed(2)),
                commissionEarned: Number(totalCommission.toFixed(2)),
                totalPayouts: Number(totalPayout.toFixed(2)),
                feeStatus,
                feeAmount: feeRecord?.amount ? Number(feeRecord.amount) : 0,
            });
        }

        return overview;
    }

    async getVendorLedger(vendorId: string) {
        const payouts = await this.payoutRepo.find({
            where: { vendor_id: vendorId },
            relations: ["booking"],
            order: { created_at: "DESC" }
        });

        const subPayments = await this.vendorSubPaymentRepo.find({
            where: { vendor_id: vendorId },
            order: { created_at: "DESC" }
        });

        const ledger = [
            ...payouts.map(p => ({
                type: "payout",
                id: p.payout_id,
                amount: p.amount,
                status: p.status,
                date: p.created_at,
                description: `Payout for booking ${p.booking?.booking_number}`
            })),
            ...subPayments.map(sp => ({
                type: "subscription_fee",
                id: sp.id,
                amount: sp.amount,
                status: sp.status,
                date: sp.payment_date || sp.created_at,
                description: `Subscription fee for ${sp.period_month}/${sp.period_year}`
            }))
        ];

        ledger.sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());

        return ledger;
    }

    async recordSubscriptionPayment(input: IRecordSubscriptionPaymentDto, adminUserId: string) {
        const sub = await this.vendorSubRepo.findOne({
            where: { vendor_id: input.vendor_id },
        });

        if (!sub) {
            throw new AppError("Vendor subscription not found", 404, ErrorCodes.NOT_FOUND);
        }

        // Upsert the fee payment record
        let record = await this.vendorSubPaymentRepo.findOne({
            where: {
                vendor_id: input.vendor_id,
                period_month: input.period_month,
                period_year: input.period_year
            }
        });

        if (!record) {
            record = this.vendorSubPaymentRepo.create({
                vendor_id: input.vendor_id,
                subscription_id: sub.id,
                period_month: input.period_month,
                period_year: input.period_year,
            });
        }

        record.amount = input.amount;
        record.status = input.status;
        record.notes = input.notes || null;
        record.recorded_by_user_id = adminUserId;
        record.payment_date = input.status === "paid" ? new Date() : null;

        const saved = await this.vendorSubPaymentRepo.save(record);

        // If marked as paid, also activate the vendor subscription so all their listings go live
        if (input.status === "paid") {
            // We need a listing to pass to VendorSubscriptionService.markPaid — find any listing of this vendor
            const listing = await this.listingRepo.findOne({
                where: { vendor_id: input.vendor_id }
            });

            if (listing) {
                await AppDataSource.transaction(async (em) => {
                    await this.vendorSubscriptionService.markPaid(em, listing, {
                        paid_at: record!.payment_date ?? new Date(),
                    });
                });
            }
        }

        return saved;
    }
    async updateSubscriptionType(vendorId: string, input: { subscription_type?: string, paid_at?: string }) {
        return this.vendorSubRepo.manager.transaction(async (manager) => {
            const current = await this.vendorSubscriptionService.getCurrent(manager, vendorId);
            if (!current) {
                // If they don't have one, create a basic one
                const newSub = this.vendorSubRepo.create({
                    vendor_id: vendorId,
                    subscription_type: (input.subscription_type as any) || SubscriptionType.MONTHLY,
                    status: ListingSubscriptionStatus.PENDING,
                });
                if (input.paid_at) {
                    const newPaidAt = new Date(input.paid_at);
                    newSub.paid_at = newPaidAt;
                    newSub.started_at = newPaidAt;
                    const nextDueDate = new Date(newPaidAt);
                    if (newSub.subscription_type === SubscriptionType.MONTHLY) {
                        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                    } else {
                        nextDueDate.setDate(nextDueDate.getDate() + 30);
                    }
                    newSub.next_due_date = nextDueDate;
                    newSub.expires_at = nextDueDate;
                    newSub.is_paid = true;
                    newSub.status = ListingSubscriptionStatus.ACTIVE;
                }
                await manager.save(newSub);
                return newSub;
            }

            if (input.subscription_type) {
                current.subscription_type = input.subscription_type as any;
            }
            if (input.paid_at) {
                const newPaidAt = new Date(input.paid_at);
                current.paid_at = newPaidAt;
                current.started_at = current.started_at || newPaidAt;
                const nextDueDate = new Date(newPaidAt);
                if (current.subscription_type === SubscriptionType.MONTHLY) {
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                } else {
                    nextDueDate.setDate(nextDueDate.getDate() + 30);
                }
                current.next_due_date = nextDueDate;
                current.expires_at = nextDueDate;
                current.is_paid = true;
                current.status = ListingSubscriptionStatus.ACTIVE;
            }
            
            await manager.save(current);
            return current;
        });
    }
}
