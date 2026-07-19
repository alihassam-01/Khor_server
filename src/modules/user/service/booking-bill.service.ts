import { EntityManager } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import {
    BookingAuditActorRole,
    BookingBillStatus,
} from "@common/enums/booking.enums";
import { UserRole } from "@common/enums/user.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { isValidUuid } from "@common/utils/uuid.util";
import {
    BookingBill,
    BookingBillItem,
    BookingBillPayment,
    HotelBooking,
} from "@modules/user/entity/booking";
import type {
    IBookingBillDTO,
    ICreateBookingBillItemDTO,
    IMarkBookingBillPaidDTO,
    IRecordBookingBillPaymentDTO,
} from "@modules/user/dtos";
import { BookingAuditService } from "./booking-audit.service";

export type AuthActor = {
    userId: string;
    userType: UserRole;
};

export class BookingBillService {
    private readonly auditService = new BookingAuditService();

    private assertUuid(value: string, fieldName: string): void {
        if (!isValidUuid(value)) {
            throw new AppError(`${fieldName} must be a valid UUID`, 400, ErrorCodes.VALIDATION_ERROR);
        }
    }

    private roundAmount(value: number): number {
        return Number(value.toFixed(2));
    }

    private computeBillTotal(items: BookingBillItem[]): number {
        return this.roundAmount(items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0));
    }

    private computeBillPaid(payments: BookingBillPayment[]): number {
        return this.roundAmount(payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0));
    }

    private computeBillStatus(totalAmount: number, paidAmount: number): BookingBillStatus {
        if (paidAmount <= 0) return BookingBillStatus.UNPAID;
        if (paidAmount < totalAmount) return BookingBillStatus.PARTIALLY_PAID;
        return BookingBillStatus.PAID;
    }

    private toDTO(bill: BookingBill): IBookingBillDTO {
        const items = [...(bill.items ?? [])].sort(
            (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );
        const payments = [...(bill.payments ?? [])].sort(
            (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );
        const totalAmount = this.computeBillTotal(items);
        const totalPaidAmount = this.computeBillPaid(payments);
        return {
            id: bill.id,
            booking_id: bill.booking_id,
            currency: bill.currency,
            total_amount: totalAmount,
            total_paid_amount: totalPaidAmount,
            outstanding_amount: this.roundAmount(Math.max(totalAmount - totalPaidAmount, 0)),
            status: this.computeBillStatus(totalAmount, totalPaidAmount),
            items: items.map((item) => ({
                id: item.id,
                item_name: item.item_name,
                amount: Number(item.amount),
                notes: item.notes ?? null,
                created_at: item.created_at,
            })),
            payments: payments.map((payment) => ({
                id: payment.id,
                amount: Number(payment.amount),
                currency: payment.currency,
                payment_method: payment.payment_method ?? null,
                transaction_id: payment.transaction_id ?? null,
                notes: payment.notes ?? null,
                created_at: payment.created_at,
            })),
            created_at: bill.created_at,
            updated_at: bill.updated_at,
        };
    }

    private async loadOwnedBooking(
        bookingId: string,
        actor: AuthActor,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<HotelBooking> {
        if (actor.userType !== UserRole.VENDOR) {
            throw new AppError("Only hotel owners can manage booking bills", 403, ErrorCodes.FORBIDDEN);
        }
        this.assertUuid(bookingId, "booking id");

        const booking = await manager.getRepository(HotelBooking)
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .where("booking.id = :bookingId", { bookingId })
            .andWhere("listing.vendor_id = :userId", { userId: actor.userId })
            .getOne();

        if (!booking) {
            throw new AppError("Booking not found", 404, ErrorCodes.NOT_FOUND);
        }
        return booking;
    }

    private async loadBillByBookingId(
        bookingId: string,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<BookingBill | null> {
        return manager.getRepository(BookingBill)
            .createQueryBuilder("bill")
            .leftJoinAndSelect("bill.items", "items")
            .leftJoinAndSelect("bill.payments", "payments")
            .where("bill.booking_id = :bookingId", { bookingId })
            .orderBy("items.created_at", "DESC")
            .addOrderBy("payments.created_at", "DESC")
            .getOne();
    }

    private async ensureBill(
        booking: HotelBooking,
        actor: AuthActor,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<BookingBill> {
        const existing = await this.loadBillByBookingId(booking.id, manager);
        if (existing) {
            return existing;
        }

        const created = manager.getRepository(BookingBill).create({
            booking_id: booking.id,
            currency: booking.currency || "PKR",
            created_by_user_id: actor.userId,
        });
        await manager.getRepository(BookingBill).save(created);
        return this.loadBillByBookingId(booking.id, manager) as Promise<BookingBill>;
    }

    async getVendorBookingBill(bookingId: string, actor: AuthActor): Promise<IBookingBillDTO> {
        const bill = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadOwnedBooking(bookingId, actor, manager);
            return this.ensureBill(booking, actor, manager);
        });
        return this.toDTO(bill);
    }

    async addVendorBookingBillItem(
        bookingId: string,
        actor: AuthActor,
        input: ICreateBookingBillItemDTO,
    ): Promise<IBookingBillDTO> {
        if (!input.item_name?.trim()) {
            throw new AppError("item_name is required", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (input.amount === 0) {
            throw new AppError("amount cannot be zero", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const bill = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadOwnedBooking(bookingId, actor, manager);
            const bill = await this.ensureBill(booking, actor, manager);
            const previousTotal = this.computeBillTotal(bill.items ?? []);

            const item = manager.getRepository(BookingBillItem).create({
                bill_id: bill.id,
                item_name: input.item_name.trim(),
                amount: this.roundAmount(input.amount),
                notes: input.notes?.trim() || null,
                created_by_user_id: actor.userId,
            });
            await manager.getRepository(BookingBillItem).save(item);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_bill_item_added_by_vendor",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.VENDOR,
                source: "vendor",
                before_state: { bill_total_amount: previousTotal },
                after_state: { bill_total_amount: this.roundAmount(previousTotal + Number(item.amount)) },
                metadata: {
                    bill_id: bill.id,
                    bill_item_id: item.id,
                    item_name: item.item_name,
                    amount: Number(item.amount),
                },
            }, manager);

            return this.loadBillByBookingId(booking.id, manager) as Promise<BookingBill>;
        });

        return this.toDTO(bill);
    }

    async removeVendorBookingBillItem(
        bookingId: string,
        itemId: string,
        actor: AuthActor,
    ): Promise<IBookingBillDTO> {
        const bill = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadOwnedBooking(bookingId, actor, manager);
            const bill = await this.ensureBill(booking, actor, manager);

            const item = await manager.getRepository(BookingBillItem).findOne({
                where: { id: itemId, bill_id: bill.id },
            });

            if (!item) {
                throw new AppError("Bill item not found", 404, ErrorCodes.NOT_FOUND);
            }

            const previousTotal = this.computeBillTotal(bill.items ?? []);

            await manager.getRepository(BookingBillItem).remove(item);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_bill_item_removed_by_vendor" as any,
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.VENDOR,
                source: "vendor",
                before_state: { bill_total_amount: previousTotal },
                after_state: { bill_total_amount: this.roundAmount(previousTotal - Number(item.amount)) },
                metadata: {
                    bill_id: bill.id,
                    bill_item_id: item.id,
                    item_name: item.item_name,
                    amount: Number(item.amount),
                },
            }, manager);

            return this.loadBillByBookingId(booking.id, manager) as Promise<BookingBill>;
        });

        return this.toDTO(bill);
    }

    async recordVendorBookingBillPayment(
        bookingId: string,
        actor: AuthActor,
        input: IRecordBookingBillPaymentDTO,
    ): Promise<IBookingBillDTO> {
        if (!(input.amount > 0)) {
            throw new AppError("amount must be greater than zero", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const bill = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadOwnedBooking(bookingId, actor, manager);
            const bill = await this.ensureBill(booking, actor, manager);
            const totalAmount = this.computeBillTotal(bill.items ?? []);
            if (totalAmount <= 0) {
                throw new AppError("Cannot record a bill payment before adding bill items", 409, ErrorCodes.CONFLICT);
            }

            const paidAmount = this.computeBillPaid(bill.payments ?? []);
            const outstandingAmount = this.roundAmount(Math.max(totalAmount - paidAmount, 0));
            const amount = this.roundAmount(input.amount);
            if (amount > outstandingAmount) {
                throw new AppError(
                    `Payment exceeds outstanding bill balance of ${outstandingAmount}`,
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const payment = manager.getRepository(BookingBillPayment).create({
                bill_id: bill.id,
                currency: bill.currency,
                amount,
                payment_method: input.payment_method ?? null,
                transaction_id: input.transaction_id ?? null,
                notes: input.notes?.trim() || null,
                created_by_user_id: actor.userId,
            });
            await manager.getRepository(BookingBillPayment).save(payment);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_bill_payment_recorded_by_vendor",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.VENDOR,
                source: "vendor",
                before_state: { bill_paid_amount: paidAmount, bill_outstanding_amount: outstandingAmount },
                after_state: {
                    bill_paid_amount: this.roundAmount(paidAmount + amount),
                    bill_outstanding_amount: this.roundAmount(Math.max(outstandingAmount - amount, 0)),
                },
                metadata: {
                    bill_id: bill.id,
                    bill_payment_id: payment.id,
                    amount,
                    payment_method: payment.payment_method,
                    transaction_id: payment.transaction_id,
                },
            }, manager);

            return this.loadBillByBookingId(booking.id, manager) as Promise<BookingBill>;
        });

        return this.toDTO(bill);
    }

    async markVendorBookingBillPaid(
        bookingId: string,
        actor: AuthActor,
        input: IMarkBookingBillPaidDTO,
    ): Promise<IBookingBillDTO> {
        const bill = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadOwnedBooking(bookingId, actor, manager);
            const bill = await this.ensureBill(booking, actor, manager);
            const totalAmount = this.computeBillTotal(bill.items ?? []);
            const paidAmount = this.computeBillPaid(bill.payments ?? []);
            const outstandingAmount = this.roundAmount(Math.max(totalAmount - paidAmount, 0));

            if (totalAmount <= 0) {
                throw new AppError("Cannot mark an empty bill as paid", 409, ErrorCodes.CONFLICT);
            }
            if (outstandingAmount <= 0) {
                return bill;
            }

            const payment = manager.getRepository(BookingBillPayment).create({
                bill_id: bill.id,
                currency: bill.currency,
                amount: outstandingAmount,
                payment_method: input.payment_method ?? null,
                transaction_id: input.transaction_id ?? null,
                notes: input.notes?.trim() || "Marked as paid",
                created_by_user_id: actor.userId,
            });
            await manager.getRepository(BookingBillPayment).save(payment);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_bill_marked_paid_by_vendor",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.VENDOR,
                source: "vendor",
                before_state: { bill_paid_amount: paidAmount, bill_outstanding_amount: outstandingAmount },
                after_state: { bill_paid_amount: totalAmount, bill_outstanding_amount: 0 },
                metadata: {
                    bill_id: bill.id,
                    bill_payment_id: payment.id,
                    amount: outstandingAmount,
                    payment_method: payment.payment_method,
                    transaction_id: payment.transaction_id,
                },
            }, manager);

            return this.loadBillByBookingId(booking.id, manager) as Promise<BookingBill>;
        });

        return this.toDTO(bill);
    }
}
