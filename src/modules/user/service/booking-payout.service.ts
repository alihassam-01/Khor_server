import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { BookingPayout } from "@modules/user/entity/booking/booking-payout.entity";
import { HotelBooking } from "@modules/user/entity/booking/hotel-booking.entity";
import { PlatformSetting } from "@modules/user/entity/payment/platform-setting.entity";
import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";
import { SubscriptionType } from "@common/enums/subscription.enums";
import {
    BookingPaymentStatus,
    BookingRefundStatus,
    BookingSource,
    HotelBookingStatus,
} from "@common/enums/booking.enums";
import { IBookingPayoutDTO, ICreateBookingPayoutDTO, IUpdateBookingPayoutDTO } from "@modules/user/dtos";

export class BookingPayoutService {
    private payoutRepo = AppDataSource.getRepository(BookingPayout);
    private bookingRepo = AppDataSource.getRepository(HotelBooking);
    private platformSettingRepo = AppDataSource.getRepository(PlatformSetting);
    private vendorSubRepo = AppDataSource.getRepository(VendorSubscription);
    private readonly payoutCommissionKey = "global_payout_commission_rate";
    private readonly monthlyCommissionKey = "commission_rate_monthly";
    private readonly freeCommissionKey = "commission_rate_free";

    private normalizeRate(rate: number | null | undefined): number {
        if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) {
            return 0;
        }
        return rate <= 1 ? rate : rate / 100;
    }

    private roundAmount(value: number): number {
        return Number(value.toFixed(2));
    }

    private getEligibilityTimestamp(checkInDate: string): Date {
        const parsedCheckIn = new Date(`${checkInDate}T00:00:00.000Z`);
        return new Date(parsedCheckIn.getTime() + 24 * 60 * 60 * 1000);
    }

    private toDTO(payout: BookingPayout): IBookingPayoutDTO {
        return {
            payout_id: payout.payout_id,
            vendor_id: payout.vendor_id ?? null,
            booking_id: payout.booking_id,
            amount: Number(payout.amount),
            gross_amount: payout.gross_amount !== null && payout.gross_amount !== undefined ? Number(payout.gross_amount) : null,
            commission_rate: payout.commission_rate !== null && payout.commission_rate !== undefined ? Number(payout.commission_rate) : null,
            commission_amount: payout.commission_amount !== null && payout.commission_amount !== undefined ? Number(payout.commission_amount) : null,
            status: payout.status,
            payout_date: payout.payout_date ?? null,
            created_at: payout.created_at,
            updated_at: payout.updated_at,
        };
    }

    async getAllPayouts(): Promise<IBookingPayoutDTO[]> {
        const payouts = await this.payoutRepo.find({
            order: { created_at: "DESC" },
        });
        return payouts.map((payout) => this.toDTO(payout));
    }

    async getPayoutsByVendor(vendorId: string): Promise<IBookingPayoutDTO[]> {
        const payouts = await this.payoutRepo.find({
            where: { vendor_id: vendorId },
            order: { created_at: "DESC" },
        });
        return payouts.map((payout) => this.toDTO(payout));
    }

    async createPayout(input: ICreateBookingPayoutDTO): Promise<IBookingPayoutDTO> {
        const requestedAmount = (input as ICreateBookingPayoutDTO & { amount?: unknown }).amount;
        if (requestedAmount !== undefined) {
            throw new AppError(
                "Payout amount is calculated from captured booking payments and cannot be supplied by the client",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }

        const booking = await this.bookingRepo.findOne({
            where: { id: input.booking_id },
            relations: ["listing", "payments", "refunds"],
        });

        if (!booking) {
            throw new AppError("Booking not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (booking.source !== BookingSource.CUSTOMER_WEB) {
            throw new AppError("Payouts are only available for online bookings", 400, ErrorCodes.BAD_REQUEST);
        }

        if (![HotelBookingStatus.CHECKED_IN, HotelBookingStatus.COMPLETED].includes(booking.booking_status)) {
            throw new AppError("Payouts can only be created for checked-in or completed bookings", 409, ErrorCodes.CONFLICT);
        }

        const eligibleAt = this.getEligibilityTimestamp(booking.check_in_date);
        if (Date.now() < eligibleAt.getTime()) {
            throw new AppError("Payouts can only be created 24 hours after the check-in date", 409, ErrorCodes.CONFLICT);
        }

        if (![BookingPaymentStatus.PAID, BookingPaymentStatus.PARTIALLY_REFUNDED].includes(booking.payment_status)) {
            throw new AppError("Payouts can only be created for paid bookings", 409, ErrorCodes.CONFLICT);
        }

        const activeRefund = (booking.refunds ?? []).find((refund) =>
            [
                BookingRefundStatus.REQUESTED,
                BookingRefundStatus.APPROVED,
                BookingRefundStatus.PROCESSING,
            ].includes(refund.status),
        );
        if (activeRefund) {
            throw new AppError("Cannot create a payout while a refund is in progress", 409, ErrorCodes.CONFLICT);
        }

        const existingPayout = await this.payoutRepo.findOne({
            where: { booking_id: booking.id },
        });

        if (existingPayout) {
            throw new AppError("Payout already exists for this booking", 409, ErrorCodes.CONFLICT);
        }

        const capturedAmount = this.roundAmount(
            (booking.payments ?? []).reduce((sum, payment) => sum + Number(payment.captured_amount ?? 0), 0),
        );
        const refundedAmount = this.roundAmount(
            (booking.payments ?? []).reduce((sum, payment) => sum + Number(payment.refunded_amount ?? 0), 0),
        );
        const netCapturedAmount = this.roundAmount(capturedAmount - refundedAmount);

        if (netCapturedAmount <= 0) {
            throw new AppError("Cannot create a payout without a positive captured balance", 409, ErrorCodes.CONFLICT);
        }

        let targetCommissionKey = this.freeCommissionKey;
        if (booking.listing?.vendor_id) {
            const vendorSub = await this.vendorSubRepo.findOne({
                where: { vendor_id: booking.listing.vendor_id },
                order: { created_at: "DESC" },
            });
            if (vendorSub?.subscription_type === SubscriptionType.MONTHLY) {
                targetCommissionKey = this.monthlyCommissionKey;
            }
        }

        let commissionSetting = await this.platformSettingRepo.findOne({
            where: { setting_key: targetCommissionKey },
        });

        // Fallback to legacy global key if specific tier key is missing
        if (!commissionSetting) {
            commissionSetting = await this.platformSettingRepo.findOne({
                where: { setting_key: this.payoutCommissionKey },
            });
        }

        const rawGlobalRate = commissionSetting ? Number(commissionSetting.setting_value) : 0;
        const commissionRate = this.normalizeRate(rawGlobalRate);
        const grossAmount = netCapturedAmount;
        const commissionAmount = this.roundAmount(grossAmount * commissionRate);
        const payoutAmount = this.roundAmount(Math.max(grossAmount - commissionAmount, 0));

        const payout = this.payoutRepo.create({
            booking_id: booking.id,
            vendor_id: booking.listing?.vendor_id ?? null,
            amount: payoutAmount,
            gross_amount: grossAmount,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            status: "pending",
        });

        const saved = await this.payoutRepo.save(payout);
        return this.toDTO(saved);
    }

    async updatePayoutStatus(payoutId: string, input: IUpdateBookingPayoutDTO): Promise<IBookingPayoutDTO> {
        const payout = await this.payoutRepo.findOne({
            where: { payout_id: payoutId },
        });

        if (!payout) {
            throw new AppError("Payout not found", 404, ErrorCodes.NOT_FOUND);
        }

        payout.status = input.status;
        payout.payout_date = input.status === "completed" ? new Date() : payout.payout_date ?? null;

        const saved = await this.payoutRepo.save(payout);
        return this.toDTO(saved);
    }
}
