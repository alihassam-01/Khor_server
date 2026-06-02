import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { BookingPayout } from "@modules/user/entity/booking/booking-payout.entity";
import { HotelBooking } from "@modules/user/entity/booking/hotel-booking.entity";
import { PlatformSetting } from "@modules/user/entity/payment/platform-setting.entity";
import { BookingSource } from "@common/enums/booking.enums";
import { IBookingPayoutDTO, ICreateBookingPayoutDTO, IUpdateBookingPayoutDTO } from "@modules/user/dtos";

export class BookingPayoutService {
    private payoutRepo = AppDataSource.getRepository(BookingPayout);
    private bookingRepo = AppDataSource.getRepository(HotelBooking);
    private platformSettingRepo = AppDataSource.getRepository(PlatformSetting);
    private readonly payoutCommissionKey = "global_payout_commission_rate";

    private normalizeRate(rate: number | null | undefined): number {
        if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) {
            return 0;
        }
        return rate <= 1 ? rate : rate / 100;
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
        const booking = await this.bookingRepo.findOne({
            where: { id: input.booking_id },
            relations: ["listing"],
        });

        if (!booking) {
            throw new AppError("Booking not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (booking.source !== BookingSource.CUSTOMER_WEB) {
            throw new AppError("Payouts are only available for online bookings", 400, ErrorCodes.BAD_REQUEST);
        }

        const existingPayout = await this.payoutRepo.findOne({
            where: { booking_id: booking.id },
        });

        if (existingPayout) {
            throw new AppError("Payout already exists for this booking", 409, ErrorCodes.CONFLICT);
        }

        const globalCommissionSetting = await this.platformSettingRepo.findOne({
            where: { setting_key: this.payoutCommissionKey },
        });
        const rawGlobalRate = globalCommissionSetting ? Number(globalCommissionSetting.setting_value) : 0;
        const commissionRate = this.normalizeRate(rawGlobalRate);
        const grossAmount = Number(booking.total_amount);
        const commissionAmount = grossAmount * commissionRate;
        const payoutAmount = input.amount ?? Math.max(grossAmount - commissionAmount, 0);

        const payout = this.payoutRepo.create({
            booking_id: booking.id,
            vendor_id: booking.listing?.vendor_id ?? input.vendor_id ?? null,
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
