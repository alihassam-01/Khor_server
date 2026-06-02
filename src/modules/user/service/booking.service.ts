import { AppDataSource } from "@config/ormconfig";
import { EntityManager } from "typeorm";
import {
    BookingHoldStatus,
    BookingRefundStatus,
    BookingRefundType,
    BookingAuditActorRole,
    BookingCancellationStatus,
    BookingPaymentStatus,
    BookingSource,
    BookingStatusType,
    HotelBookingStatus,
} from "@common/enums/booking.enums";
import { UserRole } from "@common/enums/user.enums";
import { ListingType } from "@common/enums/listing.enums";
import {
    BookingAuditLog,
    BookingRefund,
    BookingRoomHold,
    BookingStatusHistory,
    HotelBooking,
    HotelBookingAllocation,
} from "@modules/user/entity/booking";
import { BookingPayment } from "@modules/user/entity/booking/booking-payment.entity";
import { HotelDetails } from "@modules/user/entity/listing/hotel-details.entity";
import { HotelPromotion } from "@modules/user/entity/listing/hotel-promotion.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import {
    IBookingHoldDTO,
    IBookingTimelineEventDTO,
    IVendorBookingHoldDTO,
    ICreateHotelBookingHoldDTO,
    ICreateHotelBookingDTO,
    IHotelAvailabilityDTO,
    IHotelBookingDTO,
    IHotelBookingListResponseDTO,
    IRecordBookingPaymentDTO,
    IBookingRefundDTO,
    IBookingRefundListResponseDTO,
    IRefundRequestDTO,
} from "@modules/user/dtos";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { isValidUuid } from "@common/utils/uuid.util";
import { BookingAuditService } from "./booking-audit.service";
import { BookingStatusHistoryService } from "./booking-status-history.service";
import { bookingRealtimeService } from "./booking-realtime.service";
import { SendEmail } from "./email/sendEmail";
import { pickBestPromotion } from "./listing/hotel-promotion.util";
import { NotificationService, type NotificationPayload } from "./notification.service";

const ACTIVE_BOOKING_STATUSES = [
    HotelBookingStatus.PENDING,
    HotelBookingStatus.CONFIRMED,
    HotelBookingStatus.CHECKED_IN,
] as const;

type AuthActor = {
    userId: string;
    userType: UserRole;
};

type BookingListParams = {
    page?: number;
    limit?: number;
    booking_status?: string;
    listing_id?: string;
};

type RefundListParams = {
    page?: number;
    limit?: number;
    status?: string;
};

export class BookingService {
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly roomTypeRepo = AppDataSource.getRepository(HotelRoomType);
    private readonly refundRepo = AppDataSource.getRepository(BookingRefund);
    private readonly auditService = new BookingAuditService();
    private readonly statusHistoryService = new BookingStatusHistoryService();
    private readonly emailService = new SendEmail();
    private readonly notificationService = new NotificationService();
    private readonly holdDurationMs = 10 * 60 * 1000;

    private assertUuid(value: string, fieldName: string): void {
        if (!isValidUuid(value)) {
            throw new AppError(`${fieldName} must be a valid UUID`, 400, ErrorCodes.VALIDATION_ERROR);
        }
    }

    private parseDate(value: string, fieldName: string): Date {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
            throw new AppError(`${fieldName} must be a valid date`, 400, ErrorCodes.VALIDATION_ERROR);
        }
        return parsed;
    }

    private getRefundEligibilityDeadline(checkInDate: string, cutoffHours: number): Date {
        const checkIn = this.parseDate(checkInDate, "check_in_date");
        return new Date(checkIn.getTime() - (cutoffHours * 60 * 60 * 1000));
    }

    private async getHotelRefundCutoffHours(
        manager: EntityManager,
        listingId: string,
    ): Promise<number | null> {
        const details = await manager.getRepository(HotelDetails).findOne({
            where: { listing_id: listingId },
            select: ["listing_id", "refund_cutoff_hours"],
        });

        if (details?.refund_cutoff_hours == null) {
            return null;
        }

        return Math.max(0, Number(details.refund_cutoff_hours));
    }

    private async shouldAutoConfirmPaidBooking(
        manager: EntityManager,
        listingId: string,
    ): Promise<boolean> {
        const details = await manager.getRepository(HotelDetails).findOne({
            where: { listing_id: listingId },
            select: ["listing_id", "auto_confirm_paid_bookings"],
        });

        return !!details?.auto_confirm_paid_bookings;
    }

    private async getActivePromotionForRoomType(
        manager: EntityManager,
        listingId: string,
        roomType: HotelRoomType,
    ) {
        const promotions = await manager.getRepository(HotelPromotion).find({
            where: { listing_id: listingId, is_active: true },
            order: { created_at: "DESC" },
        });
        return pickBestPromotion(Number(roomType.price), promotions, roomType.type ?? null);
    }

    private async assertRefundRequestAllowed(
        manager: EntityManager,
        booking: HotelBooking,
    ): Promise<void> {
        const cutoffHours = await this.getHotelRefundCutoffHours(manager, booking.listing_id);
        if (cutoffHours == null) {
            return;
        }

        if (cutoffHours === 0) {
            throw new AppError(
                "Refund requests are not available for this hotel.",
                409,
                ErrorCodes.CONFLICT,
            );
        }

        const deadline = this.getRefundEligibilityDeadline(booking.check_in_date, cutoffHours);
        if (Date.now() > deadline.getTime()) {
            throw new AppError(
                `Refund requests for this hotel must be submitted at least ${cutoffHours} hour(s) before check-in.`,
                409,
                ErrorCodes.CONFLICT,
            );
        }
    }

    private validateCreateInput(dto: ICreateHotelBookingDTO): void {
        this.assertUuid(dto.listing_id, "listing_id");
        this.assertUuid(dto.room_type_id, "room_type_id");
        if (dto.hold_id) {
            this.assertUuid(dto.hold_id, "hold_id");
        }

        if (!dto.guest_name?.trim()) {
            throw new AppError("guest_name is required", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!dto.guest_email?.trim()) {
            throw new AppError("guest_email is required", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!dto.guest_phone?.trim()) {
            throw new AppError("guest_phone is required", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!Number.isInteger(dto.rooms_count) || dto.rooms_count <= 0) {
            throw new AppError("rooms_count must be a positive integer", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!Number.isInteger(dto.guest_count) || dto.guest_count <= 0) {
            throw new AppError("guest_count must be a positive integer", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (dto.payment_amount !== undefined && dto.payment_amount < 0) {
            throw new AppError("payment_amount cannot be negative", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const checkIn = this.parseDate(dto.check_in_date, "check_in_date");
        const checkOut = this.parseDate(dto.check_out_date, "check_out_date");
        if (checkOut <= checkIn) {
            throw new AppError(
                "check_out_date must be after check_in_date",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }
    }

    private validateHoldInput(dto: ICreateHotelBookingHoldDTO): void {
        this.assertUuid(dto.listing_id, "listing_id");
        this.assertUuid(dto.room_type_id, "room_type_id");
        if (!Number.isInteger(dto.rooms_count) || dto.rooms_count <= 0) {
            throw new AppError("rooms_count must be a positive integer", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!Number.isInteger(dto.guest_count) || dto.guest_count <= 0) {
            throw new AppError("guest_count must be a positive integer", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const checkIn = this.parseDate(dto.check_in_date, "check_in_date");
        const checkOut = this.parseDate(dto.check_out_date, "check_out_date");
        if (checkOut <= checkIn) {
            throw new AppError(
                "check_out_date must be after check_in_date",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }
    }

    private calculateNights(checkInDate: string, checkOutDate: string): number {
        const checkIn = this.parseDate(checkInDate, "check_in_date");
        const checkOut = this.parseDate(checkOutDate, "check_out_date");
        const diffMs = checkOut.getTime() - checkIn.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    private roundAmount(value: number): number {
        return Number(value.toFixed(2));
    }

    private sumCaptured(payments: BookingPayment[] = []): number {
        return this.roundAmount(
            payments.reduce((sum, payment) => sum + Number(payment.captured_amount ?? 0), 0),
        );
    }

    private sumRefunded(payments: BookingPayment[] = []): number {
        return this.roundAmount(
            payments.reduce((sum, payment) => sum + Number(payment.refunded_amount ?? 0), 0),
        );
    }

    private computeBookingPaymentStatus(
        totalAmount: number,
        payments: BookingPayment[] = [],
    ): BookingPaymentStatus {
        const capturedTotal = this.sumCaptured(payments);
        const refundedTotal = this.sumRefunded(payments);
        const netPaid = this.roundAmount(capturedTotal - refundedTotal);

        if (capturedTotal <= 0) return BookingPaymentStatus.PENDING;
        if (netPaid <= 0 && refundedTotal > 0) return BookingPaymentStatus.REFUNDED;
        if (netPaid < totalAmount) return BookingPaymentStatus.PARTIALLY_PAID;
        if (refundedTotal > 0) return BookingPaymentStatus.PARTIALLY_REFUNDED;
        return BookingPaymentStatus.PAID;
    }

    private computeOutstandingAmount(totalAmount: number, payments: BookingPayment[] = []): number {
        const netPaid = this.roundAmount(this.sumCaptured(payments) - this.sumRefunded(payments));
        return this.roundAmount(Math.max(totalAmount - netPaid, 0));
    }

    private async insertBookingPayment(
        manager: EntityManager,
        input: {
            booking_id: string;
            payment_method?: string | null;
            payment_status: BookingPaymentStatus;
            currency: string;
            amount: number;
            captured_amount: number;
            refunded_amount: number;
            provider?: string | null;
            provider_payment_id?: string | null;
            transaction_id?: string | null;
            receipt_url?: string | null;
            notes?: string | null;
            metadata?: Record<string, unknown> | null;
            created_by_user_id?: string | null;
        },
    ): Promise<string> {
        if (!input.booking_id) {
            throw new AppError(
                "Cannot insert booking payment because booking_id is missing",
                500,
                ErrorCodes.INTERNAL_SERVER_ERROR,
            );
        }

        const result = await manager.query(
            `
                INSERT INTO booking_payments (
                    booking_id,
                    payment_method,
                    payment_status,
                    currency,
                    amount,
                    captured_amount,
                    refunded_amount,
                    provider,
                    provider_payment_id,
                    transaction_id,
                    receipt_url,
                    notes,
                    metadata,
                    created_by_user_id
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                )
                RETURNING id
            `,
            [
                input.booking_id,
                input.payment_method ?? null,
                input.payment_status,
                input.currency,
                input.amount,
                input.captured_amount,
                input.refunded_amount,
                input.provider ?? null,
                input.provider_payment_id ?? null,
                input.transaction_id ?? null,
                input.receipt_url ?? null,
                input.notes ?? null,
                input.metadata ?? null,
                input.created_by_user_id ?? null,
            ],
        );

        return String(result?.[0]?.id ?? "");
    }

    private async loadLockedRoomType(
        manager: EntityManager,
        roomTypeId: string,
    ): Promise<HotelRoomType & { listing: Listing }> {
        const roomType = await manager.getRepository(HotelRoomType)
            .createQueryBuilder("room_type")
            .innerJoinAndSelect("room_type.listing", "listing")
            .where("room_type.id = :roomTypeId", { roomTypeId })
            .setLock("pessimistic_write")
            .getOne();

        if (!roomType) {
            throw new AppError("Room type not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (roomType.listing.type !== ListingType.HOTEL) {
            throw new AppError("Only hotel room types can be booked", 400, ErrorCodes.VALIDATION_ERROR);
        }

        return roomType as HotelRoomType & { listing: Listing };
    }

    private async getReservedRoomCount(
        manager: EntityManager,
        roomTypeId: string,
        checkInDate: string,
        checkOutDate: string,
    ): Promise<number> {
        const raw = await manager.getRepository(HotelBookingAllocation)
            .createQueryBuilder("allocation")
            .innerJoin("allocation.booking", "booking")
            .select("COALESCE(SUM(allocation.quantity_reserved), 0)", "reserved_rooms")
            .where("allocation.room_type_id = :roomTypeId", { roomTypeId })
            .andWhere("booking.booking_status IN (:...activeStatuses)", {
                activeStatuses: ACTIVE_BOOKING_STATUSES,
            })
            .andWhere("booking.check_in_date < :checkOutDate", { checkOutDate })
            .andWhere("booking.check_out_date > :checkInDate", { checkInDate })
            .getRawOne<{ reserved_rooms: string }>();

        return Number(raw?.reserved_rooms ?? 0);
    }

    private async getActiveHoldRoomCount(
        manager: EntityManager,
        roomTypeId: string,
        checkInDate: string,
        checkOutDate: string,
        excludeHoldId?: string,
    ): Promise<number> {
        const qb = manager.getRepository(BookingRoomHold)
            .createQueryBuilder("hold")
            .select("COALESCE(SUM(hold.rooms_count), 0)", "held_rooms")
            .where("hold.room_type_id = :roomTypeId", { roomTypeId })
            .andWhere("hold.status = :status", { status: BookingHoldStatus.ACTIVE })
            .andWhere("hold.expires_at > NOW()")
            .andWhere("hold.check_in_date < :checkOutDate", { checkOutDate })
            .andWhere("hold.check_out_date > :checkInDate", { checkInDate });

        if (excludeHoldId) {
            qb.andWhere("hold.id != :excludeHoldId", { excludeHoldId });
        }

        const raw = await qb.getRawOne<{ held_rooms: string }>();
        return Number(raw?.held_rooms ?? 0);
    }

    private async expireStaleHolds(manager: EntityManager = AppDataSource.manager): Promise<number> {
        const staleHolds = await manager.getRepository(BookingRoomHold)
            .createQueryBuilder("hold")
            .innerJoinAndSelect("hold.listing", "listing")
            .where("hold.status = :status", { status: BookingHoldStatus.ACTIVE })
            .andWhere("hold.expires_at <= NOW()")
            .getMany();

        if (staleHolds.length === 0) {
            return 0;
        }

        await manager.getRepository(BookingRoomHold)
            .createQueryBuilder()
            .update(BookingRoomHold)
            .set({
                status: BookingHoldStatus.EXPIRED,
                released_at: () => "NOW()",
            })
            .where("id IN (:...ids)", { ids: staleHolds.map((hold) => hold.id) })
            .execute();

        for (const hold of staleHolds) {
            await this.publishHoldEvent(
                hold as BookingRoomHold & { listing: Listing },
                "hold_expired",
                manager,
            );
        }

        return staleHolds.length;
    }

    private toHoldDTO(hold: BookingRoomHold): IBookingHoldDTO {
        return {
            id: hold.id,
            listing_id: hold.listing_id,
            room_type_id: hold.room_type_id,
            rooms_count: hold.rooms_count,
            guest_count: hold.guest_count,
            check_in_date: hold.check_in_date,
            check_out_date: hold.check_out_date,
            expires_at: hold.expires_at,
            status: hold.status,
            created_at: hold.created_at,
        };
    }

    private toVendorHoldDTO(
        hold: BookingRoomHold & { listing: Listing; room_type: HotelRoomType },
    ): IVendorBookingHoldDTO {
        return {
            id: hold.id,
            listing: {
                id: hold.listing.id,
                name: hold.listing.name,
                location_id: hold.listing.location_id,
            },
            room_type: {
                id: hold.room_type.id,
                name: hold.room_type.name,
                total_rooms: hold.room_type.total_rooms,
                capacity: hold.room_type.capacity,
            },
            rooms_count: hold.rooms_count,
            guest_count: hold.guest_count,
            check_in_date: hold.check_in_date,
            check_out_date: hold.check_out_date,
            expires_at: hold.expires_at,
            status: hold.status,
            created_at: hold.created_at,
        };
    }

    private publishInventoryEvent(input: {
        action: string;
        listingId: string;
        roomTypeId?: string | null;
        vendorId?: string | null;
        customerUserId?: string | null;
        bookingSource?: string | null;
        bookingId?: string | null;
        holdId?: string | null;
    }): void {
        bookingRealtimeService.publish({
            type: "inventory_changed",
            action: input.action,
            listing_id: input.listingId,
            room_type_id: input.roomTypeId ?? null,
            vendor_id: input.vendorId ?? null,
            customer_user_id: input.customerUserId ?? null,
            booking_source: input.bookingSource ?? null,
            booking_id: input.bookingId ?? null,
            hold_id: input.holdId ?? null,
            occurred_at: new Date().toISOString(),
        });
    }

    private buildBookingNotifications(
        booking: HotelBooking & { listing: Listing },
        action: string,
    ): NotificationPayload[] {
        const entries: NotificationPayload[] = [];
        const roomName = (booking as HotelBooking & { room_type?: HotelRoomType | null }).room_type?.name?.trim() || "room";
        const hotelName = booking.listing.name?.trim() || "hotel";
        const messageMap: Record<string, {
            category: "booking" | "payment" | "hold" | "system";
            customerTitle: string;
            customerMessage: string;
            vendorTitle: string;
            vendorMessage: string;
        }> = {
            booking_created: {
                category: "booking",
                customerTitle: "Booking created",
                customerMessage: `Your booking for ${roomName} at ${hotelName} has been created successfully.`,
                vendorTitle: "New booking received",
                vendorMessage: `${roomName} was booked by a customer.`,
            },
            booking_confirmed_by_vendor: {
                category: "booking",
                customerTitle: "Booking confirmed",
                customerMessage: `Your booking for ${roomName} was confirmed by ${hotelName}.`,
                vendorTitle: "Booking confirmed",
                vendorMessage: `${roomName} booking has been marked as confirmed.`,
            },
            booking_cancelled_by_vendor: {
                category: "booking",
                customerTitle: "Booking cancelled",
                customerMessage: `${hotelName} cancelled your booking for ${roomName}.`,
                vendorTitle: "Booking cancelled",
                vendorMessage: `${roomName} booking has been cancelled by the hotel.`,
            },
            booking_cancelled_by_admin: {
                category: "booking",
                customerTitle: "Booking cancelled",
                customerMessage: `An admin cancelled your booking for ${roomName}.`,
                vendorTitle: "Booking cancelled",
                vendorMessage: `An admin cancelled the booking for ${roomName}.`,
            },
            booking_checked_in_by_vendor: {
                category: "booking",
                customerTitle: "Checked in",
                customerMessage: `Your ${roomName} booking was marked as checked in.`,
                vendorTitle: "Guest checked in",
                vendorMessage: `Guest checked in for ${roomName}.`,
            },
            booking_completed_by_vendor: {
                category: "booking",
                customerTitle: "Stay completed",
                customerMessage: `Your stay in ${roomName} was marked as completed.`,
                vendorTitle: "Stay completed",
                vendorMessage: `${roomName} stay has been marked as completed.`,
            },
            booking_completed_by_admin: {
                category: "booking",
                customerTitle: "Stay completed",
                customerMessage: `Your stay in ${roomName} was marked as completed.`,
                vendorTitle: "Stay completed",
                vendorMessage: `An admin marked the ${roomName} stay as completed.`,
            },
            booking_payment_recorded_by_vendor: {
                category: "payment",
                customerTitle: "Payment recorded",
                customerMessage: `A payment was recorded for your ${roomName} booking.`,
                vendorTitle: "Payment recorded",
                vendorMessage: `A payment update was recorded for ${roomName}.`,
            },
            booking_cancellation_requested: {
                category: "booking",
                customerTitle: "Cancellation requested",
                customerMessage: `Your cancellation request for ${roomName} was received.`,
                vendorTitle: "Cancellation requested",
                vendorMessage: `A customer requested cancellation for ${roomName}.`,
            },
            booking_refund_requested: {
                category: "payment",
                customerTitle: "Refund requested",
                customerMessage: `Your refund request for ${roomName} was submitted.`,
                vendorTitle: "Refund requested",
                vendorMessage: `A customer requested a refund for ${roomName}.`,
            },
            booking_refund_approved: {
                category: "payment",
                customerTitle: "Refund approved",
                customerMessage: `Your refund request for ${roomName} was approved.`,
                vendorTitle: "Refund approved",
                vendorMessage: `A refund was approved for ${roomName}.`,
            },
            booking_refund_rejected: {
                category: "payment",
                customerTitle: "Refund rejected",
                customerMessage: `Your refund request for ${roomName} was rejected.`,
                vendorTitle: "Refund rejected",
                vendorMessage: `A refund was rejected for ${roomName}.`,
            },
            booking_refund_completed: {
                category: "payment",
                customerTitle: "Refund completed",
                customerMessage: `Your refund for ${roomName} was marked as paid.`,
                vendorTitle: "Refund completed",
                vendorMessage: `A refund was marked as completed for ${roomName}.`,
            },
        };

        const messageSet = messageMap[action];
        if (!messageSet) return entries;

        if (booking.customer_user_id) {
            entries.push({
                recipient_user_id: booking.customer_user_id,
                category: messageSet.category,
                title: messageSet.customerTitle,
                message: messageSet.customerMessage,
                action,
                booking_id: booking.id,
                listing_id: booking.listing_id,
                room_type_id: booking.room_type_id,
            });
        }

        if (booking.listing.vendor_id) {
            entries.push({
                recipient_user_id: booking.listing.vendor_id,
                category: messageSet.category,
                title: messageSet.vendorTitle,
                message: messageSet.vendorMessage,
                action,
                booking_id: booking.id,
                listing_id: booking.listing_id,
                room_type_id: booking.room_type_id,
            });
        }

        return entries;
    }

    private buildHoldNotifications(
        hold: BookingRoomHold & { listing: Listing },
        action: string,
    ): NotificationPayload[] {
        const entries: NotificationPayload[] = [];
        const messageMap: Record<string, {
            category: "booking" | "payment" | "hold" | "system";
            customerTitle: string;
            customerMessage: string;
            vendorTitle: string;
            vendorMessage: string;
        }> = {
            hold_created: {
                category: "hold",
                customerTitle: "Room hold created",
                customerMessage: "Your selected room is being held for checkout.",
                vendorTitle: "Room hold active",
                vendorMessage: "A customer is holding one of your rooms during checkout.",
            },
            hold_expired: {
                category: "hold",
                customerTitle: "Room hold expired",
                customerMessage: "Your room hold expired and the room is available again.",
                vendorTitle: "Room hold expired",
                vendorMessage: "A customer room hold expired and inventory was released.",
            },
            hold_consumed: {
                category: "hold",
                customerTitle: "Room hold converted",
                customerMessage: "Your room hold was converted into a booking.",
                vendorTitle: "Room hold converted",
                vendorMessage: "A customer room hold has turned into a booking.",
            },
            hold_released_by_new_hold: {
                category: "hold",
                customerTitle: "Previous room hold released",
                customerMessage: "Your earlier room hold was released when a new hold was created.",
                vendorTitle: "Room hold released",
                vendorMessage: "An earlier room hold was released and replaced by a new one.",
            },
        };

        const messageSet = messageMap[action];
        if (!messageSet) return entries;

        entries.push({
            recipient_user_id: hold.customer_user_id,
            category: messageSet.category,
            title: messageSet.customerTitle,
            message: messageSet.customerMessage,
            action,
            hold_id: hold.id,
            listing_id: hold.listing_id,
            room_type_id: hold.room_type_id,
        });

        return entries;
    }

    private async publishBookingEvent(
        booking: HotelBooking & { listing: Listing },
        action: string,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<void> {
        await this.notificationService.createMany(this.buildBookingNotifications(booking, action), manager);
        bookingRealtimeService.publish({
            type: "booking_changed",
            action,
            listing_id: booking.listing_id,
            room_type_id: booking.room_type_id,
            vendor_id: booking.listing.vendor_id ?? null,
            customer_user_id: booking.customer_user_id ?? null,
            booking_source: booking.source,
            booking_id: booking.id,
            occurred_at: new Date().toISOString(),
        });

        this.publishInventoryEvent({
            action,
            listingId: booking.listing_id,
            roomTypeId: booking.room_type_id,
            vendorId: booking.listing.vendor_id ?? null,
            customerUserId: booking.customer_user_id ?? null,
            bookingSource: booking.source,
            bookingId: booking.id,
        });
    }

    private async publishHoldEvent(
        hold: BookingRoomHold & { listing: Listing },
        action: string,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<void> {
        await this.notificationService.createMany(this.buildHoldNotifications(hold, action), manager);
        bookingRealtimeService.publish({
            type: "hold_changed",
            action,
            listing_id: hold.listing_id,
            room_type_id: hold.room_type_id,
            vendor_id: hold.listing.vendor_id ?? null,
            customer_user_id: hold.customer_user_id,
            booking_source: BookingSource.CUSTOMER_WEB,
            hold_id: hold.id,
            occurred_at: new Date().toISOString(),
        });

        this.publishInventoryEvent({
            action,
            listingId: hold.listing_id,
            roomTypeId: hold.room_type_id,
            vendorId: hold.listing.vendor_id ?? null,
            customerUserId: hold.customer_user_id,
            bookingSource: BookingSource.CUSTOMER_WEB,
            holdId: hold.id,
        });
    }

    private async loadLockedActiveHold(
        manager: EntityManager,
        holdId: string,
        customerUserId: string,
    ): Promise<BookingRoomHold> {
        const hold = await manager.getRepository(BookingRoomHold)
            .createQueryBuilder("hold")
            .where("hold.id = :holdId", { holdId })
            .andWhere("hold.customer_user_id = :customerUserId", { customerUserId })
            .setLock("pessimistic_write")
            .getOne();

        if (!hold) {
            throw new AppError("Booking hold not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (hold.status !== BookingHoldStatus.ACTIVE) {
            throw new AppError("This booking hold is no longer active", 409, ErrorCodes.CONFLICT);
        }

        if (hold.expires_at.getTime() <= Date.now()) {
            hold.status = BookingHoldStatus.EXPIRED;
            hold.released_at = new Date();
            await manager.getRepository(BookingRoomHold).save(hold);
            const holdWithListing = await manager.getRepository(BookingRoomHold)
                .createQueryBuilder("stale_hold")
                .innerJoinAndSelect("stale_hold.listing", "listing")
                .where("stale_hold.id = :holdId", { holdId: hold.id })
                .getOne();
            if (holdWithListing) {
                await this.publishHoldEvent(
                    holdWithListing as BookingRoomHold & { listing: Listing },
                    "hold_expired",
                    manager,
                );
            }
            throw new AppError("Your 10-minute room hold has expired", 409, ErrorCodes.CONFLICT);
        }

        return hold;
    }

    private async ensureVendorOwnsListing(
        manager: EntityManager,
        vendorId: string,
        listingId: string,
    ): Promise<void> {
        const listing = await manager.getRepository(Listing).findOne({
            where: { id: listingId, vendor_id: vendorId, type: ListingType.HOTEL },
            select: ["id"],
        });

        if (!listing) {
            throw new AppError(
                "Hotel not found for this owner",
                404,
                ErrorCodes.NOT_FOUND,
            );
        }
    }

    private async createBooking(
        dto: ICreateHotelBookingDTO,
        actor: AuthActor,
        source: BookingSource,
    ): Promise<IHotelBookingDTO> {
        this.validateCreateInput(dto);

        if (source === BookingSource.CUSTOMER_WEB && actor.userType !== UserRole.CUSTOMER) {
            throw new AppError("Only customers can create web bookings", 403, ErrorCodes.FORBIDDEN);
        }

        if (source === BookingSource.PARTNER_MANUAL && actor.userType !== UserRole.VENDOR) {
            throw new AppError("Only hotel owners can create partner bookings", 403, ErrorCodes.FORBIDDEN);
        }

        const booking = await AppDataSource.transaction(async (manager) => {
            await this.expireStaleHolds(manager);
            const roomType = await this.loadLockedRoomType(manager, dto.room_type_id);

            if (roomType.listing_id !== dto.listing_id) {
                throw new AppError(
                    "The selected room type does not belong to the requested hotel",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            if (!roomType.is_active) {
                throw new AppError(
                    "This room type is currently in maintenance",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            if (source === BookingSource.CUSTOMER_WEB && !roomType.listing.is_active) {
                throw new AppError(
                    "This hotel is not available for online booking",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            if (source === BookingSource.PARTNER_MANUAL) {
                await this.ensureVendorOwnsListing(manager, actor.userId, dto.listing_id);
            }

            if (dto.guest_count > roomType.capacity * dto.rooms_count) {
                throw new AppError(
                    "Guest count exceeds the selected room capacity",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const reservedRooms = await this.getReservedRoomCount(
                manager,
                dto.room_type_id,
                dto.check_in_date,
                dto.check_out_date,
            );
            let hold: BookingRoomHold | null = null;
            let heldRooms = 0;

            if (source === BookingSource.CUSTOMER_WEB) {
                if (!dto.hold_id) {
                    throw new AppError(
                        "A valid room hold is required before completing checkout",
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }

                hold = await this.loadLockedActiveHold(manager, dto.hold_id, actor.userId);

                const mismatchedHold = hold.listing_id !== dto.listing_id
                    || hold.room_type_id !== dto.room_type_id
                    || hold.rooms_count !== dto.rooms_count
                    || hold.guest_count !== dto.guest_count
                    || hold.check_in_date !== dto.check_in_date
                    || hold.check_out_date !== dto.check_out_date;

                if (mismatchedHold) {
                    throw new AppError(
                        "The booking details do not match the active room hold",
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }
            }

            heldRooms = await this.getActiveHoldRoomCount(
                manager,
                dto.room_type_id,
                dto.check_in_date,
                dto.check_out_date,
                hold?.id,
            );

            const availableRooms = roomType.total_rooms - reservedRooms - heldRooms;

            if (dto.rooms_count > availableRooms) {
                throw new AppError(
                    `Only ${Math.max(availableRooms, 0)} room(s) are available for the selected dates`,
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const nights = this.calculateNights(dto.check_in_date, dto.check_out_date);
            const baseNightlyRate = Number(roomType.price);
            const activePromotion = await this.getActivePromotionForRoomType(
                manager,
                dto.listing_id,
                roomType,
            );
            const nightlyRate = this.roundAmount(activePromotion?.discounted_price ?? baseNightlyRate);
            const subtotal = this.roundAmount(baseNightlyRate * dto.rooms_count * nights);
            const discountAmount = this.roundAmount((baseNightlyRate - nightlyRate) * dto.rooms_count * nights);
            const totalAmount = this.roundAmount(subtotal - discountAmount);
            const initialPaymentAmount = this.roundAmount(dto.payment_amount ?? 0);

            if (source === BookingSource.CUSTOMER_WEB && initialPaymentAmount !== totalAmount) {
                throw new AppError(
                    "Online bookings require a single full payment equal to the booking total",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            if (source === BookingSource.PARTNER_MANUAL && initialPaymentAmount > totalAmount) {
                throw new AppError(
                    "Initial payment cannot exceed the booking total",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const initialBookingPaymentStatus = initialPaymentAmount <= 0
                ? BookingPaymentStatus.PENDING
                : initialPaymentAmount < totalAmount
                    ? BookingPaymentStatus.PARTIALLY_PAID
                    : BookingPaymentStatus.PAID;
            const shouldAutoConfirmCustomerBooking = source === BookingSource.CUSTOMER_WEB
                && initialBookingPaymentStatus === BookingPaymentStatus.PAID
                && await this.shouldAutoConfirmPaidBooking(manager, dto.listing_id);

            const booking = manager.getRepository(HotelBooking).create({
                source,
                customer_user_id: source === BookingSource.CUSTOMER_WEB ? actor.userId : null,
                guest_name: dto.guest_name.trim(),
                guest_email: dto.guest_email.trim().toLowerCase(),
                guest_phone: dto.guest_phone.trim(),
                listing_id: dto.listing_id,
                room_type_id: dto.room_type_id,
                rooms_count: dto.rooms_count,
                guest_count: dto.guest_count,
                check_in_date: dto.check_in_date,
                check_out_date: dto.check_out_date,
                nights,
                currency: "PKR",
                nightly_rate_snapshot: nightlyRate,
                subtotal_amount: subtotal,
                discount_amount: discountAmount,
                tax_amount: 0,
                total_amount: totalAmount,
                booking_status: source === BookingSource.PARTNER_MANUAL || shouldAutoConfirmCustomerBooking
                    ? HotelBookingStatus.CONFIRMED
                    : HotelBookingStatus.PENDING,
                payment_status: initialBookingPaymentStatus,
                cancellation_status: BookingCancellationStatus.NOT_REQUESTED,
                special_requests: dto.special_requests?.trim() || null,
                created_by_user_id: actor.userId,
                confirmed_by_user_id: source === BookingSource.PARTNER_MANUAL
                    ? actor.userId
                    : shouldAutoConfirmCustomerBooking
                        ? roomType.listing.vendor_id ?? null
                        : null,
                confirmed_at: source === BookingSource.PARTNER_MANUAL || shouldAutoConfirmCustomerBooking
                    ? new Date()
                    : null,
            });

            const savedBooking = await manager.getRepository(HotelBooking).save(booking);
            const allocation = manager.getRepository(HotelBookingAllocation).create({
                booking_id: savedBooking.id,
                listing_id: dto.listing_id,
                room_type_id: dto.room_type_id,
                quantity_reserved: dto.rooms_count,
            });
            await manager.getRepository(HotelBookingAllocation).save(allocation);

            if (activePromotion?.id) {
                await manager.getRepository(HotelPromotion).increment(
                    { id: activePromotion.id },
                    "usage_count",
                    1,
                );
            }

            if (initialPaymentAmount > 0) {
                await this.insertBookingPayment(manager, {
                    booking_id: savedBooking.id,
                    payment_method: dto.payment_method ?? null,
                    payment_status: BookingPaymentStatus.PAID,
                    currency: savedBooking.currency,
                    amount: initialPaymentAmount,
                    captured_amount: initialPaymentAmount,
                    refunded_amount: 0,
                    provider: dto.payment_provider ?? null,
                    transaction_id: dto.transaction_id ?? null,
                    notes: dto.payment_notes?.trim() || null,
                    created_by_user_id: actor.userId,
                });
            }

            const paymentSnapshot = await manager.getRepository(BookingPayment).find({
                where: { booking_id: savedBooking.id },
                order: { created_at: "DESC" },
            });

            savedBooking.payment_status = this.computeBookingPaymentStatus(
                Number(savedBooking.total_amount),
                paymentSnapshot,
            );
            await manager.getRepository(HotelBooking).save(savedBooking);

            if (hold) {
                hold.status = BookingHoldStatus.CONSUMED;
                hold.consumed_at = new Date();
                await manager.getRepository(BookingRoomHold).save(hold);
                await this.publishHoldEvent(
                    {
                        ...hold,
                        listing: roomType.listing,
                    } as BookingRoomHold & { listing: Listing },
                    "hold_consumed",
                    manager,
                );
            }

            await this.statusHistoryService.record({
                booking_id: savedBooking.id,
                status_type: BookingStatusType.BOOKING,
                from_status: null,
                to_status: savedBooking.booking_status,
                changed_by_user_id: actor.userId,
                metadata: { source },
            }, manager);

            await this.statusHistoryService.record({
                booking_id: savedBooking.id,
                status_type: BookingStatusType.PAYMENT,
                from_status: null,
                to_status: savedBooking.payment_status,
                changed_by_user_id: actor.userId,
                metadata: { source, payment_amount: initialPaymentAmount },
            }, manager);

            await this.auditService.record({
                booking_id: savedBooking.id,
                event_type: "booking_created",
                actor_user_id: actor.userId,
                actor_role: source === BookingSource.CUSTOMER_WEB
                    ? BookingAuditActorRole.CUSTOMER
                    : BookingAuditActorRole.VENDOR,
                source,
                after_state: {
                    booking_status: savedBooking.booking_status,
                    payment_status: savedBooking.payment_status,
                },
                metadata: {
                    listing_id: dto.listing_id,
                    room_type_id: dto.room_type_id,
                    rooms_count: dto.rooms_count,
                    guest_count: dto.guest_count,
                    payment_amount: initialPaymentAmount,
                    hold_id: hold?.id ?? null,
                },
            }, manager);

            await this.publishBookingEvent(
                {
                    ...savedBooking,
                    listing: roomType.listing,
                    room_type: roomType,
                } as HotelBooking & { listing: Listing },
                "booking_created",
                manager,
            );

            return this.getBookingById(savedBooking.id, actor, source === BookingSource.CUSTOMER_WEB ? "customer" : "vendor", manager);
        });
        await this.notifyBookingLifecycle(
            booking.id,
            booking.booking_status === HotelBookingStatus.CONFIRMED ? "confirmed" : "created",
        );
        return booking;
    }

    private async loadBookingForActor(
        bookingId: string,
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        manager: EntityManager = AppDataSource.manager,
    ): Promise<HotelBooking> {
        this.assertUuid(bookingId, "booking id");

        const qb = manager.getRepository(HotelBooking)
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.location", "listing_location")
            .leftJoinAndSelect("listing.contact", "listing_contact")
            .leftJoinAndSelect("listing.hotel_details", "listing_hotel_details")
            .leftJoinAndSelect("listing.media", "listing_media")
            .leftJoinAndSelect("listing.vendor", "listing_vendor")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .leftJoinAndSelect("booking.payments", "payments")
            .leftJoinAndSelect("booking.refunds", "refunds")
            .where("booking.id = :bookingId", { bookingId });

        if (scope === "customer") {
            qb.andWhere("booking.customer_user_id = :userId", { userId: actor.userId });
        } else if (scope === "vendor") {
            qb.andWhere("listing.vendor_id = :userId", { userId: actor.userId });
        } else {
            qb.andWhere("booking.source = :bookingSource", {
                bookingSource: BookingSource.CUSTOMER_WEB,
            });
        }

        const booking = await qb
            .orderBy("payments.created_at", "DESC")
            .addOrderBy("refunds.created_at", "DESC")
            .getOne();
        if (!booking) {
            throw new AppError("Booking not found", 404, ErrorCodes.NOT_FOUND);
        }
        return booking;
    }

    private toDTO(booking: HotelBooking): IHotelBookingDTO {
        return {
            id: booking.id,
            booking_number: booking.booking_number,
            source: booking.source,
            customer_user_id: booking.customer_user_id ?? null,
            guest: {
                name: booking.guest_name,
                email: booking.guest_email,
                phone: booking.guest_phone,
            },
            listing: {
                id: booking.listing.id,
                name: booking.listing.name,
                location_id: booking.listing.location_id,
                commission_rate: null,
                location: booking.listing.location?.name ?? null,
                address: booking.listing.contact?.address ?? null,
                image: booking.listing.media?.[0]?.url ?? null,
                images: (booking.listing.media ?? []).map((media) => media.url),
                links: {
                    phone: booking.listing.contact?.phone ?? null,
                    email: booking.listing.vendor?.email ?? null,
                    website: booking.listing.contact?.website ?? null,
                    map_link: booking.listing.contact?.map_link ?? null,
                },
                cancellation_policy: booking.listing.hotel_details?.cancellation_policy ?? null,
                refund_cutoff_hours: booking.listing.hotel_details?.refund_cutoff_hours ?? null,
                check_in_time: booking.listing.hotel_details?.check_in_time ?? null,
                check_out_time: booking.listing.hotel_details?.check_out_time ?? null,
            },
            room_type: {
                id: booking.room_type.id,
                name: booking.room_type.name,
                total_rooms: booking.room_type.total_rooms,
                capacity: booking.room_type.capacity,
            },
            rooms_count: booking.rooms_count,
            guest_count: booking.guest_count,
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            nights: booking.nights,
            currency: booking.currency,
            nightly_rate_snapshot: Number(booking.nightly_rate_snapshot),
            subtotal_amount: Number(booking.subtotal_amount),
            discount_amount: Number(booking.discount_amount),
            tax_amount: Number(booking.tax_amount),
            total_amount: Number(booking.total_amount),
            outstanding_amount: this.computeOutstandingAmount(
                Number(booking.total_amount),
                booking.payments ?? [],
            ),
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,
            cancellation_status: booking.cancellation_status,
            refund_status: booking.refund_status,
            special_requests: booking.special_requests ?? null,
            confirmed_at: booking.confirmed_at ?? null,
            cancelled_at: booking.cancelled_at ?? null,
            completed_at: booking.completed_at ?? null,
            created_at: booking.created_at,
            updated_at: booking.updated_at,
            payments: (booking.payments ?? []).map((payment: BookingPayment) => ({
                id: payment.id,
                amount: Number(payment.amount),
                captured_amount: Number(payment.captured_amount),
                refunded_amount: Number(payment.refunded_amount),
                currency: payment.currency,
                payment_status: payment.payment_status,
                payment_method: payment.payment_method ?? null,
                transaction_id: payment.transaction_id ?? null,
                notes: payment.notes ?? null,
                created_at: payment.created_at,
            })),
            refunds: (booking.refunds ?? []).map((refund: BookingRefund) => ({
                id: refund.id,
                payment_id: refund.payment_id ?? null,
                refund_type: refund.refund_type,
                amount: Number(refund.amount),
                status: refund.status,
                reason: refund.reason ?? null,
                provider_refund_id: refund.provider_refund_id ?? null,
                processed_at: refund.processed_at ?? null,
                created_at: refund.created_at,
                updated_at: refund.updated_at,
            })),
        };
    }

    private getUserDisplayName(user?: {
        email?: string | null;
        profile?: { username?: string | null } | null;
    } | null): string | null {
        return user?.profile?.username?.trim() || user?.email?.trim() || null;
    }

    private formatTimelineTitle(eventType: string, toStatus?: string | null): string {
        const byEventType: Record<string, string> = {
            booking_created: "Booking created",
            booking_confirmed_by_vendor: "Booking confirmed",
            booking_cancelled_by_vendor: "Booking cancelled by hotel",
            booking_cancelled_by_admin: "Booking cancelled by admin",
            booking_checked_in_by_vendor: "Guest checked in",
            booking_completed_by_vendor: "Stay completed",
            booking_completed_by_admin: "Stay completed",
            booking_payment_recorded_by_vendor: "Payment recorded",
            booking_cancellation_requested: "Cancellation requested",
            booking_refund_requested: "Refund requested",
            booking_refund_approved: "Refund approved",
            booking_refund_rejected: "Refund rejected",
            booking_refund_completed: "Refund completed",
        };

        if (byEventType[eventType]) return byEventType[eventType];
        if (toStatus) {
            return toStatus.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
        }
        return eventType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private toTimelineStatusEvent(entry: BookingStatusHistory): IBookingTimelineEventDTO {
        return {
            id: entry.id,
            entry_type: "status",
            event_type: `${entry.status_type}_status_changed`,
            title: this.formatTimelineTitle(`${entry.status_type}_status_changed`, entry.to_status),
            description: entry.reason ?? null,
            status_type: entry.status_type,
            from_status: entry.from_status ?? null,
            to_status: entry.to_status,
            source: null,
            reason: entry.reason ?? null,
            actor: entry.changed_by ? {
                user_id: entry.changed_by.id,
                role: entry.changed_by.userType,
                name: this.getUserDisplayName(entry.changed_by),
                email: entry.changed_by.email,
            } : null,
            metadata: entry.metadata ?? null,
            created_at: entry.created_at,
        };
    }

    private toTimelineAuditEvent(entry: BookingAuditLog): IBookingTimelineEventDTO {
        return {
            id: entry.id,
            entry_type: "audit",
            event_type: entry.event_type,
            title: this.formatTimelineTitle(entry.event_type),
            description: typeof entry.metadata?.reason === "string" ? entry.metadata.reason : null,
            status_type: null,
            from_status: null,
            to_status: null,
            source: entry.source ?? null,
            reason: typeof entry.metadata?.reason === "string" ? entry.metadata.reason : null,
            actor: entry.actor ? {
                user_id: entry.actor.id,
                role: entry.actor_role,
                name: this.getUserDisplayName(entry.actor),
                email: entry.actor.email,
            } : {
                user_id: entry.actor_user_id ?? null,
                role: entry.actor_role,
                name: entry.actor_role === BookingAuditActorRole.SYSTEM ? "System" : null,
                email: null,
            },
            metadata: entry.metadata ?? null,
            created_at: entry.created_at,
        };
    }

    private async loadBookingNotificationContext(
        bookingId: string,
    ): Promise<(HotelBooking & {
        listing: Listing & { vendor?: { id: string; email: string; userType: UserRole; profile?: { username?: string | null } | null } | null };
        room_type: HotelRoomType;
    }) | null> {
        return this.bookingRepo.createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.vendor", "vendor")
            .leftJoinAndSelect("vendor.profile", "vendor_profile")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .where("booking.id = :bookingId", { bookingId })
            .getOne() as Promise<(HotelBooking & {
                listing: Listing & { vendor?: { id: string; email: string; userType: UserRole; profile?: { username?: string | null } | null } | null };
                room_type: HotelRoomType;
            }) | null>;
    }

    private async notifyBookingLifecycle(
        bookingId: string,
        event: "created" | "confirmed" | "cancelled" | "checked_in" | "completed" | "cancellation_requested" | "refund_requested" | "payment_recorded",
        reason?: string | null,
    ): Promise<void> {
        const booking = await this.loadBookingNotificationContext(bookingId);
        if (!booking) return;

        const vendorName = this.getUserDisplayName(booking.listing.vendor);
        const vendorEmail = booking.listing.vendor?.email ?? null;
        const customerName = booking.guest_name;
        const customerEmail = booking.guest_email;

        const config = {
            created: {
                customerSubject: `Booking received: ${booking.booking_number}`,
                customerHeading: "Your booking has been received",
                customerIntro: "We have received your hotel booking and shared it with the hotel owner.",
                vendorSubject: `New booking received: ${booking.booking_number}`,
                vendorHeading: "A new booking has been placed",
                vendorIntro: "A customer has booked one of your rooms through Khor.",
            },
            confirmed: {
                customerSubject: `Booking confirmed: ${booking.booking_number}`,
                customerHeading: "Your booking is confirmed",
                customerIntro: "The hotel owner has confirmed your booking.",
                vendorSubject: `Booking confirmed: ${booking.booking_number}`,
                vendorHeading: "Booking marked as confirmed",
                vendorIntro: "This booking is now confirmed in Khor.",
            },
            cancelled: {
                customerSubject: `Booking cancelled: ${booking.booking_number}`,
                customerHeading: "Your booking has been cancelled",
                customerIntro: "This booking has been cancelled and the room inventory has been released.",
                vendorSubject: `Booking cancelled: ${booking.booking_number}`,
                vendorHeading: "Booking cancelled",
                vendorIntro: "This booking has been cancelled and inventory is available again.",
            },
            checked_in: {
                customerSubject: `Check-in recorded: ${booking.booking_number}`,
                customerHeading: "Check-in recorded",
                customerIntro: "The hotel owner has marked this booking as checked in.",
                vendorSubject: `Guest checked in: ${booking.booking_number}`,
                vendorHeading: "Guest checked in",
                vendorIntro: "This booking has been marked as checked in.",
            },
            completed: {
                customerSubject: `Stay completed: ${booking.booking_number}`,
                customerHeading: "Stay completed",
                customerIntro: "This stay has been marked as completed.",
                vendorSubject: `Booking completed: ${booking.booking_number}`,
                vendorHeading: "Booking completed",
                vendorIntro: "This stay has been marked as completed.",
            },
            cancellation_requested: {
                customerSubject: `Cancellation request received: ${booking.booking_number}`,
                customerHeading: "Cancellation request received",
                customerIntro: "Your cancellation request has been recorded and the room is available again.",
                vendorSubject: `Customer requested cancellation: ${booking.booking_number}`,
                vendorHeading: "Cancellation requested",
                vendorIntro: "A customer requested cancellation for this booking.",
            },
            refund_requested: {
                customerSubject: `Refund request received: ${booking.booking_number}`,
                customerHeading: "Refund request received",
                customerIntro: "Your refund request has been recorded.",
                vendorSubject: `Customer requested refund: ${booking.booking_number}`,
                vendorHeading: "Refund requested",
                vendorIntro: "A customer submitted a refund request for this booking.",
            },
            payment_recorded: {
                customerSubject: `Payment updated: ${booking.booking_number}`,
                customerHeading: "Payment updated",
                customerIntro: "A payment update has been recorded for your booking.",
                vendorSubject: `Payment recorded: ${booking.booking_number}`,
                vendorHeading: "Payment recorded",
                vendorIntro: "A payment update has been recorded for this booking.",
            },
        }[event];

        const emailJobs: Promise<unknown>[] = [];

        if (customerEmail) {
            emailJobs.push(this.emailService.sendBookingLifecycleEmail({
                to: customerEmail,
                recipientName: customerName,
                subject: config.customerSubject,
                heading: config.customerHeading,
                intro: config.customerIntro,
                bookingNumber: booking.booking_number,
                hotelName: booking.listing.name,
                roomName: booking.room_type.name,
                checkInDate: booking.check_in_date,
                checkOutDate: booking.check_out_date,
                totalAmount: Number(booking.total_amount),
                guestCount: booking.guest_count,
                reason: reason ?? null,
                counterpartyName: vendorName,
                counterpartyEmail: vendorEmail,
                metadata: { bookingId: booking.id, event, recipient: "customer" },
            }));
        }

        if (vendorEmail) {
            emailJobs.push(this.emailService.sendBookingLifecycleEmail({
                to: vendorEmail,
                recipientName: vendorName,
                subject: config.vendorSubject,
                heading: config.vendorHeading,
                intro: config.vendorIntro,
                bookingNumber: booking.booking_number,
                hotelName: booking.listing.name,
                roomName: booking.room_type.name,
                checkInDate: booking.check_in_date,
                checkOutDate: booking.check_out_date,
                totalAmount: Number(booking.total_amount),
                guestCount: booking.guest_count,
                reason: reason ?? null,
                counterpartyName: customerName,
                counterpartyEmail: customerEmail,
                metadata: { bookingId: booking.id, event, recipient: "vendor" },
            }));
        }

        await Promise.allSettled(emailJobs);
    }

    async getBookingTimeline(
        bookingId: string,
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        manager: EntityManager = AppDataSource.manager,
    ): Promise<IBookingTimelineEventDTO[]> {
        await this.loadBookingForActor(bookingId, actor, scope, manager);

        const [statusHistory, auditLogs] = await Promise.all([
            manager.getRepository(BookingStatusHistory)
                .createQueryBuilder("entry")
                .leftJoinAndSelect("entry.changed_by", "changed_by")
                .leftJoinAndSelect("changed_by.profile", "changed_by_profile")
                .where("entry.booking_id = :bookingId", { bookingId })
                .orderBy("entry.created_at", "DESC")
                .getMany(),
            manager.getRepository(BookingAuditLog)
                .createQueryBuilder("entry")
                .leftJoinAndSelect("entry.actor", "actor")
                .leftJoinAndSelect("actor.profile", "actor_profile")
                .where("entry.booking_id = :bookingId", { bookingId })
                .orderBy("entry.created_at", "DESC")
                .getMany(),
        ]);

        return [
            ...statusHistory.map((entry) => this.toTimelineStatusEvent(entry)),
            ...auditLogs.map((entry) => this.toTimelineAuditEvent(entry)),
        ].sort((left, right) => right.created_at.getTime() - left.created_at.getTime());
    }

    private async listBookings(
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        params: BookingListParams,
    ): Promise<IHotelBookingListResponseDTO> {
        const page = params.page && params.page > 0 ? params.page : 1;
        const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
        const skip = (page - 1) * limit;

        const qb = this.bookingRepo.createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.location", "listing_location")
            .leftJoinAndSelect("listing.contact", "listing_contact")
            .leftJoinAndSelect("listing.hotel_details", "listing_hotel_details")
            .leftJoinAndSelect("listing.media", "listing_media")
            .leftJoinAndSelect("listing.vendor", "listing_vendor")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .leftJoinAndSelect("booking.payments", "payments");
        qb.leftJoinAndSelect("booking.refunds", "refunds");

        if (scope === "customer") {
            qb.where("booking.customer_user_id = :userId", { userId: actor.userId });
        } else if (scope === "vendor") {
            qb.where("listing.vendor_id = :userId", { userId: actor.userId });
        } else {
            qb.where("booking.source = :bookingSource", {
                bookingSource: BookingSource.CUSTOMER_WEB,
            });
        }

        if (params.booking_status) {
            qb.andWhere("booking.booking_status = :status", { status: params.booking_status });
        }

        if (params.listing_id) {
            this.assertUuid(params.listing_id, "listing_id");
            qb.andWhere("booking.listing_id = :listingId", { listingId: params.listing_id });
        }

        const [items, total] = await qb
            .orderBy("booking.created_at", "DESC")
            .addOrderBy("payments.created_at", "DESC")
            .addOrderBy("refunds.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            items: items.map((item) => this.toDTO(item)),
            total,
            page,
            limit,
        };
    }

    private async updateBookingStatus(
        bookingId: string,
        actor: AuthActor,
        scope: "vendor" | "admin",
        nextStatus: HotelBookingStatus,
        eventType: string,
        reason?: string,
    ): Promise<IHotelBookingDTO> {
        const booking = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(bookingId, actor, scope, manager);
            const previousStatus = booking.booking_status;
            const previousCancellationStatus = booking.cancellation_status;

            if (previousStatus === HotelBookingStatus.CANCELLED) {
                throw new AppError("Cancelled bookings cannot be updated", 409, ErrorCodes.CONFLICT);
            }
            if (previousStatus === HotelBookingStatus.COMPLETED) {
                throw new AppError("Completed bookings cannot be updated", 409, ErrorCodes.CONFLICT);
            }

            if (nextStatus === HotelBookingStatus.CONFIRMED && previousStatus !== HotelBookingStatus.PENDING) {
                throw new AppError("Only pending bookings can be confirmed", 409, ErrorCodes.CONFLICT);
            }
            if (nextStatus === HotelBookingStatus.CHECKED_IN && previousStatus !== HotelBookingStatus.CONFIRMED) {
                throw new AppError("Only confirmed bookings can be checked in", 409, ErrorCodes.CONFLICT);
            }
            if (nextStatus === HotelBookingStatus.COMPLETED && previousStatus !== HotelBookingStatus.CHECKED_IN) {
                throw new AppError("Only checked-in bookings can be completed", 409, ErrorCodes.CONFLICT);
            }

            booking.booking_status = nextStatus;
            if (nextStatus === HotelBookingStatus.CONFIRMED) {
                booking.confirmed_by_user_id = actor.userId;
                booking.confirmed_at = new Date();
            }
            if (nextStatus === HotelBookingStatus.CANCELLED) {
                booking.cancellation_status = BookingCancellationStatus.CANCELLED;
                booking.cancelled_by_user_id = actor.userId;
                booking.cancelled_at = new Date();
            }
            if (nextStatus === HotelBookingStatus.COMPLETED) {
                booking.completed_by_user_id = actor.userId;
                booking.completed_at = new Date();
            }

            const saved = await manager.getRepository(HotelBooking).save(booking);

            await this.statusHistoryService.record({
                booking_id: saved.id,
                status_type: BookingStatusType.BOOKING,
                from_status: previousStatus,
                to_status: nextStatus,
                changed_by_user_id: actor.userId,
                reason: reason ?? null,
            }, manager);

            if (nextStatus === HotelBookingStatus.CANCELLED) {
                await this.statusHistoryService.record({
                    booking_id: saved.id,
                    status_type: BookingStatusType.CANCELLATION,
                    from_status: previousCancellationStatus,
                    to_status: BookingCancellationStatus.CANCELLED,
                    changed_by_user_id: actor.userId,
                    reason: reason ?? null,
                }, manager);
            }

            await this.auditService.record({
                booking_id: saved.id,
                event_type: eventType,
                actor_user_id: actor.userId,
                source: scope,
                before_state: { booking_status: previousStatus },
                after_state: { booking_status: nextStatus },
                metadata: reason ? { reason } : null,
            }, manager);

            await this.publishBookingEvent(
                saved as HotelBooking & { listing: Listing },
                eventType,
                manager,
            );

            return this.getBookingById(saved.id, actor, scope, manager);
        });
        if (nextStatus === HotelBookingStatus.CONFIRMED) {
            await this.notifyBookingLifecycle(booking.id, "confirmed", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.CANCELLED) {
            await this.notifyBookingLifecycle(booking.id, "cancelled", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.CHECKED_IN) {
            await this.notifyBookingLifecycle(booking.id, "checked_in", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.COMPLETED) {
            await this.notifyBookingLifecycle(booking.id, "completed", reason ?? null);
        }
        return booking;
    }

    async createCustomerBooking(actor: AuthActor, dto: ICreateHotelBookingDTO): Promise<IHotelBookingDTO> {
        return this.createBooking(dto, actor, BookingSource.CUSTOMER_WEB);
    }

    async createVendorBooking(actor: AuthActor, dto: ICreateHotelBookingDTO): Promise<IHotelBookingDTO> {
        return this.createBooking(dto, actor, BookingSource.PARTNER_MANUAL);
    }

    async getBookingById(
        bookingId: string,
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        manager: EntityManager = AppDataSource.manager,
    ): Promise<IHotelBookingDTO> {
        const booking = await this.loadBookingForActor(bookingId, actor, scope, manager);
        return this.toDTO(booking);
    }

    async listCustomerBookings(actor: AuthActor, params: BookingListParams): Promise<IHotelBookingListResponseDTO> {
        return this.listBookings(actor, "customer", params);
    }

    async listVendorBookings(actor: AuthActor, params: BookingListParams): Promise<IHotelBookingListResponseDTO> {
        return this.listBookings(actor, "vendor", params);
    }

    async listVendorBookingHolds(actor: AuthActor): Promise<IVendorBookingHoldDTO[]> {
        if (actor.userType !== UserRole.VENDOR) {
            throw new AppError("Only hotel owners can view booking holds", 403, ErrorCodes.FORBIDDEN);
        }

        await this.expireStaleHolds();

        const holds = await AppDataSource.getRepository(BookingRoomHold)
            .createQueryBuilder("hold")
            .innerJoinAndSelect("hold.listing", "listing")
            .innerJoinAndSelect("hold.room_type", "room_type")
            .where("listing.vendor_id = :vendorId", { vendorId: actor.userId })
            .andWhere("listing.type = :listingType", { listingType: ListingType.HOTEL })
            .andWhere("hold.status = :status", { status: BookingHoldStatus.ACTIVE })
            .andWhere("hold.expires_at > NOW()")
            .orderBy("hold.expires_at", "ASC")
            .getMany();

        return holds.map((hold) => this.toVendorHoldDTO(
            hold as BookingRoomHold & { listing: Listing; room_type: HotelRoomType },
        ));
    }

    async listAdminBookings(actor: AuthActor, params: BookingListParams): Promise<IHotelBookingListResponseDTO> {
        if (actor.userType !== UserRole.ADMIN) {
            throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
        }
        return this.listBookings(actor, "admin", params);
    }

    async requestCustomerCancellation(
        bookingId: string,
        actor: AuthActor,
        reason?: string,
    ): Promise<IHotelBookingDTO> {
        const booking = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(bookingId, actor, "customer", manager);

            if (![HotelBookingStatus.PENDING, HotelBookingStatus.CONFIRMED].includes(booking.booking_status)) {
                throw new AppError(
                    "Only pending or confirmed bookings can request cancellation",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            if (booking.cancellation_status === BookingCancellationStatus.REQUESTED) {
                throw new AppError(
                    "Cancellation has already been requested for this booking",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const previousBookingStatus = booking.booking_status;
            const previousStatus = booking.cancellation_status;
            booking.booking_status = HotelBookingStatus.CANCELLED;
            booking.cancellation_status = BookingCancellationStatus.CANCELLED;
            booking.cancelled_by_user_id = actor.userId;
            booking.cancelled_at = new Date();
            await manager.getRepository(HotelBooking).save(booking);

            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.BOOKING,
                from_status: previousBookingStatus,
                to_status: HotelBookingStatus.CANCELLED,
                changed_by_user_id: actor.userId,
                reason: reason ?? null,
            }, manager);

            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.CANCELLATION,
                from_status: previousStatus,
                to_status: BookingCancellationStatus.CANCELLED,
                changed_by_user_id: actor.userId,
                reason: reason ?? null,
            }, manager);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_cancellation_requested",
                actor_user_id: actor.userId,
                source: "customer",
                before_state: {
                    booking_status: previousBookingStatus,
                    cancellation_status: previousStatus,
                },
                after_state: {
                    booking_status: HotelBookingStatus.CANCELLED,
                    cancellation_status: BookingCancellationStatus.CANCELLED,
                },
                metadata: reason ? { reason } : null,
            }, manager);

            await this.publishBookingEvent(
                booking as HotelBooking & { listing: Listing },
                "booking_cancellation_requested",
                manager,
            );

            return this.getBookingById(booking.id, actor, "customer", manager);
        });
        await this.notifyBookingLifecycle(booking.id, "cancellation_requested", reason ?? null);
        return booking;
    }

    async requestCustomerRefund(
        actor: AuthActor,
        input: IRefundRequestDTO,
    ): Promise<IBookingRefundDTO> {
        if (actor.userType !== UserRole.CUSTOMER) {
            throw new AppError("Only customers can request refunds", 403, ErrorCodes.FORBIDDEN);
        }

        this.assertUuid(input.booking_id, "booking_id");
        if (input.payment_id) this.assertUuid(input.payment_id, "payment_id");
        if (!(input.amount > 0)) {
            throw new AppError("amount must be greater than zero", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const refund = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(input.booking_id, actor, "customer", manager);
            await this.assertRefundRequestAllowed(manager, booking);

            if (
                ![
                    BookingPaymentStatus.PAID,
                    BookingPaymentStatus.PARTIALLY_PAID,
                    BookingPaymentStatus.PARTIALLY_REFUNDED,
                    BookingPaymentStatus.REFUNDED,
                ].includes(booking.payment_status)
            ) {
                throw new AppError(
                    "Refunds can only be requested for paid bookings",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const existingRequestedRefund = (booking.refunds ?? []).find((refund) =>
                [
                    BookingRefundStatus.REQUESTED,
                    BookingRefundStatus.APPROVED,
                    BookingRefundStatus.PROCESSING,
                ].includes(refund.status),
            );
            if (existingRequestedRefund) {
                throw new AppError(
                    "A refund is already in progress for this booking",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const payment = input.payment_id
                ? (booking.payments ?? []).find((entry) => entry.id === input.payment_id)
                : (booking.payments ?? [])[0];

            if (!payment) {
                throw new AppError("No eligible booking payment found", 404, ErrorCodes.NOT_FOUND);
            }

            const refundableAmount = Number(payment.captured_amount) - Number(payment.refunded_amount);
            if (input.amount > refundableAmount) {
                throw new AppError(
                    `Requested refund exceeds refundable balance of ${refundableAmount}`,
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const refund = manager.getRepository(BookingRefund).create({
                booking_id: booking.id,
                payment_id: payment.id,
                refund_type: input.amount === refundableAmount
                    ? BookingRefundType.FULL
                    : BookingRefundType.PARTIAL,
                amount: Number(input.amount.toFixed(2)),
                reason: input.reason?.trim() || null,
                requested_by_user_id: actor.userId,
                status: BookingRefundStatus.REQUESTED,
            });
            const savedRefund = await manager.getRepository(BookingRefund).save(refund);

            const previousRefundStatus = booking.refund_status;
            const previousBookingStatus = booking.booking_status;
            const previousCancellationStatus = booking.cancellation_status;
            booking.refund_status = BookingRefundStatus.REQUESTED;
            if ([HotelBookingStatus.PENDING, HotelBookingStatus.CONFIRMED].includes(booking.booking_status)) {
                booking.booking_status = HotelBookingStatus.CANCELLED;
                booking.cancellation_status = BookingCancellationStatus.CANCELLED;
                booking.cancelled_by_user_id = actor.userId;
                booking.cancelled_at = new Date();
            }
            await manager.getRepository(HotelBooking).save(booking);

            if (previousBookingStatus !== booking.booking_status) {
                await this.statusHistoryService.record({
                    booking_id: booking.id,
                    status_type: BookingStatusType.BOOKING,
                    from_status: previousBookingStatus,
                    to_status: booking.booking_status,
                    changed_by_user_id: actor.userId,
                    reason: input.reason ?? null,
                }, manager);
            }

            if (previousCancellationStatus !== booking.cancellation_status) {
                await this.statusHistoryService.record({
                    booking_id: booking.id,
                    status_type: BookingStatusType.CANCELLATION,
                    from_status: previousCancellationStatus,
                    to_status: booking.cancellation_status,
                    changed_by_user_id: actor.userId,
                    reason: input.reason ?? null,
                }, manager);
            }

            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.REFUND,
                from_status: previousRefundStatus,
                to_status: BookingRefundStatus.REQUESTED,
                changed_by_user_id: actor.userId,
                reason: input.reason ?? null,
                metadata: { refund_id: savedRefund.id, amount: savedRefund.amount },
            }, manager);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_refund_requested",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.CUSTOMER,
                source: "customer",
                before_state: { refund_status: previousRefundStatus },
                after_state: { refund_status: BookingRefundStatus.REQUESTED },
                metadata: {
                    refund_id: savedRefund.id,
                    payment_id: payment.id,
                    amount: Number(savedRefund.amount),
                    reason: savedRefund.reason ?? null,
                },
            }, manager);

            await this.publishBookingEvent(
                booking as HotelBooking & { listing: Listing },
                "booking_refund_requested",
                manager,
            );

            return this.getRefundById(savedRefund.id, actor, "customer", manager);
        });
        await this.notifyBookingLifecycle(input.booking_id, "refund_requested", input.reason ?? null);
        return refund;
    }

    private toRefundDTO(refund: BookingRefund): IBookingRefundDTO {
        return {
            id: refund.id,
            booking_id: refund.booking_id,
            booking_number: refund.booking.booking_number,
            listing_id: refund.booking.listing_id,
            listing_name: refund.booking.listing.name,
            payment_id: refund.payment_id ?? null,
            refund_type: refund.refund_type,
            amount: Number(refund.amount),
            status: refund.status,
            reason: refund.reason ?? null,
            provider_refund_id: refund.provider_refund_id ?? null,
            requested_by_user_id: refund.requested_by_user_id ?? null,
            approved_by_user_id: refund.approved_by_user_id ?? null,
            processed_at: refund.processed_at ?? null,
            created_at: refund.created_at,
            updated_at: refund.updated_at,
        };
    }

    private async loadRefundForActor(
        refundId: string,
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        manager: EntityManager = AppDataSource.manager,
    ): Promise<BookingRefund> {
        this.assertUuid(refundId, "refund id");

        const qb = manager.getRepository(BookingRefund)
            .createQueryBuilder("refund")
            .leftJoinAndSelect("refund.booking", "booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("refund.payment", "payment")
            .where("refund.id = :refundId", { refundId });

        if (scope === "customer") {
            qb.andWhere("booking.customer_user_id = :userId", { userId: actor.userId });
        } else if (scope === "vendor") {
            qb.andWhere("listing.vendor_id = :userId", { userId: actor.userId });
        } else {
            qb.andWhere("booking.source = :bookingSource", {
                bookingSource: BookingSource.CUSTOMER_WEB,
            });
        }

        const refund = await qb.getOne();
        if (!refund) {
            throw new AppError("Refund not found", 404, ErrorCodes.NOT_FOUND);
        }
        return refund;
    }

    async getRefundById(
        refundId: string,
        actor: AuthActor,
        scope: "customer" | "vendor" | "admin",
        manager: EntityManager = AppDataSource.manager,
    ): Promise<IBookingRefundDTO> {
        const refund = await this.loadRefundForActor(refundId, actor, scope, manager);
        return this.toRefundDTO(refund);
    }

    async listAdminRefunds(actor: AuthActor, params: RefundListParams): Promise<IBookingRefundListResponseDTO> {
        if (actor.userType !== UserRole.ADMIN) {
            throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
        }

        const page = params.page && params.page > 0 ? params.page : 1;
        const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
        const skip = (page - 1) * limit;

        const qb = this.refundRepo.createQueryBuilder("refund")
            .leftJoinAndSelect("refund.booking", "booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("refund.payment", "payment");

        qb.where("booking.source = :bookingSource", {
            bookingSource: BookingSource.CUSTOMER_WEB,
        });

        if (params.status) {
            qb.andWhere("refund.status = :status", { status: params.status });
        }

        const [items, total] = await qb
            .orderBy("refund.created_at", "DESC")
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            items: items.map((item) => this.toRefundDTO(item)),
            total,
            page,
            limit,
        };
    }

    private async updateRefundStatus(
        refundId: string,
        actor: AuthActor,
        nextStatus: BookingRefundStatus,
        eventType: string,
        reason?: string,
        providerRefundId?: string,
    ): Promise<IBookingRefundDTO> {
        if (actor.userType !== UserRole.ADMIN) {
            throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
        }

        return AppDataSource.transaction(async (manager) => {
            const refund = await this.loadRefundForActor(refundId, actor, "admin", manager);
            const booking = refund.booking;
            const previousStatus = refund.status;
            const previousBookingRefundStatus = booking.refund_status;

            if (nextStatus === BookingRefundStatus.APPROVED && refund.status !== BookingRefundStatus.REQUESTED) {
                throw new AppError("Only requested refunds can be approved", 409, ErrorCodes.CONFLICT);
            }
            if (nextStatus === BookingRefundStatus.REJECTED && refund.status !== BookingRefundStatus.REQUESTED) {
                throw new AppError("Only requested refunds can be rejected", 409, ErrorCodes.CONFLICT);
            }
            if (nextStatus === BookingRefundStatus.PROCESSING && refund.status !== BookingRefundStatus.APPROVED) {
                throw new AppError("Only approved refunds can move to processing", 409, ErrorCodes.CONFLICT);
            }
            if (nextStatus === BookingRefundStatus.COMPLETED && ![
                BookingRefundStatus.APPROVED,
                BookingRefundStatus.PROCESSING,
            ].includes(refund.status)) {
                throw new AppError("Refund must be approved before completion", 409, ErrorCodes.CONFLICT);
            }

            refund.status = nextStatus;
            if (nextStatus === BookingRefundStatus.APPROVED) {
                refund.approved_by_user_id = actor.userId;
            }
            if (providerRefundId !== undefined) {
                refund.provider_refund_id = providerRefundId || null;
            }
            if (nextStatus === BookingRefundStatus.COMPLETED) {
                refund.processed_at = new Date();
            }
            if (reason !== undefined) {
                refund.reason = reason || refund.reason;
            }

            await manager.getRepository(BookingRefund).save(refund);

            booking.refund_status = nextStatus;

            if (nextStatus === BookingRefundStatus.COMPLETED && refund.payment) {
                refund.payment.refunded_amount = Number(refund.payment.refunded_amount) + Number(refund.amount);
                const totalRefunded = Number(refund.payment.refunded_amount);
                const captured = Number(refund.payment.captured_amount);

                refund.payment.payment_status = totalRefunded >= captured
                    ? BookingPaymentStatus.REFUNDED
                    : BookingPaymentStatus.PARTIALLY_REFUNDED;
                await manager.getRepository(BookingPayment).save(refund.payment);
            }

            const paymentSnapshot = await manager.getRepository(BookingPayment).find({
                where: { booking_id: booking.id },
                order: { created_at: "DESC" },
            });
            booking.payment_status = this.computeBookingPaymentStatus(
                Number(booking.total_amount),
                paymentSnapshot,
            );

            await manager.getRepository(HotelBooking).save(booking);

            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.REFUND,
                from_status: previousBookingRefundStatus,
                to_status: nextStatus,
                changed_by_user_id: actor.userId,
                reason: reason ?? null,
                metadata: {
                    refund_id: refund.id,
                    provider_refund_id: refund.provider_refund_id ?? null,
                },
            }, manager);

            if (nextStatus === BookingRefundStatus.COMPLETED && refund.payment) {
                await this.statusHistoryService.record({
                    booking_id: booking.id,
                    status_type: BookingStatusType.PAYMENT,
                    from_status: previousStatus === BookingRefundStatus.COMPLETED
                        ? booking.payment_status
                        : previousBookingRefundStatus,
                    to_status: booking.payment_status,
                    changed_by_user_id: actor.userId,
                    metadata: {
                        refund_id: refund.id,
                        refunded_amount: Number(refund.payment.refunded_amount),
                    },
                }, manager);
            }

            await this.auditService.record({
                booking_id: booking.id,
                event_type: eventType,
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.ADMIN,
                source: "admin",
                before_state: {
                    refund_status: previousStatus,
                    booking_refund_status: previousBookingRefundStatus,
                },
                after_state: {
                    refund_status: nextStatus,
                    booking_refund_status: booking.refund_status,
                    payment_status: booking.payment_status,
                },
                metadata: {
                    refund_id: refund.id,
                    reason: reason ?? null,
                    provider_refund_id: refund.provider_refund_id ?? null,
                },
            }, manager);

            await this.publishBookingEvent(
                booking as HotelBooking & { listing: Listing },
                eventType,
                manager,
            );

            return this.getRefundById(refund.id, actor, "admin", manager);
        });
    }

    async approveRefund(refundId: string, actor: AuthActor, reason?: string): Promise<IBookingRefundDTO> {
        return this.updateRefundStatus(
            refundId,
            actor,
            BookingRefundStatus.APPROVED,
            "booking_refund_approved",
            reason,
        );
    }

    async rejectRefund(refundId: string, actor: AuthActor, reason?: string): Promise<IBookingRefundDTO> {
        return this.updateRefundStatus(
            refundId,
            actor,
            BookingRefundStatus.REJECTED,
            "booking_refund_rejected",
            reason,
        );
    }

    async processRefund(
        refundId: string,
        actor: AuthActor,
        providerRefundId?: string,
        reason?: string,
    ): Promise<IBookingRefundDTO> {
        return this.updateRefundStatus(
            refundId,
            actor,
            BookingRefundStatus.COMPLETED,
            "booking_refund_completed",
            reason,
            providerRefundId,
        );
    }

    async cancelAdminBooking(bookingId: string, actor: AuthActor, reason?: string): Promise<IHotelBookingDTO> {
        if (actor.userType !== UserRole.ADMIN) {
            throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
        }
        return this.updateBookingStatus(
            bookingId,
            actor,
            "admin",
            HotelBookingStatus.CANCELLED,
            "booking_cancelled_by_admin",
            reason,
        );
    }

    async completeAdminBooking(bookingId: string, actor: AuthActor): Promise<IHotelBookingDTO> {
        if (actor.userType !== UserRole.ADMIN) {
            throw new AppError("Admin access required", 403, ErrorCodes.FORBIDDEN);
        }
        return this.updateBookingStatus(
            bookingId,
            actor,
            "admin",
            HotelBookingStatus.COMPLETED,
            "booking_completed_by_admin",
        );
    }

    async confirmVendorBooking(bookingId: string, actor: AuthActor): Promise<IHotelBookingDTO> {
        return this.updateBookingStatus(
            bookingId,
            actor,
            "vendor",
            HotelBookingStatus.CONFIRMED,
            "booking_confirmed_by_vendor",
        );
    }

    async cancelVendorBooking(bookingId: string, actor: AuthActor, reason?: string): Promise<IHotelBookingDTO> {
        return this.updateBookingStatus(
            bookingId,
            actor,
            "vendor",
            HotelBookingStatus.CANCELLED,
            "booking_cancelled_by_vendor",
            reason,
        );
    }

    async checkInVendorBooking(bookingId: string, actor: AuthActor): Promise<IHotelBookingDTO> {
        return this.updateBookingStatus(
            bookingId,
            actor,
            "vendor",
            HotelBookingStatus.CHECKED_IN,
            "booking_checked_in_by_vendor",
        );
    }

    async completeVendorBooking(bookingId: string, actor: AuthActor): Promise<IHotelBookingDTO> {
        return this.updateBookingStatus(
            bookingId,
            actor,
            "vendor",
            HotelBookingStatus.COMPLETED,
            "booking_completed_by_vendor",
        );
    }

    async recordVendorPayment(
        bookingId: string,
        actor: AuthActor,
        input: IRecordBookingPaymentDTO,
    ): Promise<IHotelBookingDTO> {
        if (actor.userType !== UserRole.VENDOR) {
            throw new AppError("Only hotel owners can record manual booking payments", 403, ErrorCodes.FORBIDDEN);
        }
        if (!(input.amount > 0)) {
            throw new AppError("amount must be greater than zero", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const booking = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(bookingId, actor, "vendor", manager);
            const resolvedBookingId = booking.id || bookingId;
            this.assertUuid(resolvedBookingId, "booking id");

            if (booking.booking_status === HotelBookingStatus.CANCELLED) {
                throw new AppError("Cannot record payments on a cancelled booking", 409, ErrorCodes.CONFLICT);
            }

            const outstandingAmount = this.computeOutstandingAmount(
                Number(booking.total_amount),
                booking.payments ?? [],
            );
            const amount = this.roundAmount(input.amount);

            if (amount > outstandingAmount) {
                throw new AppError(
                    `Payment exceeds outstanding balance of ${outstandingAmount}`,
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const paymentId = await this.insertBookingPayment(manager, {
                booking_id: resolvedBookingId,
                payment_method: input.payment_method ?? null,
                payment_status: BookingPaymentStatus.PAID,
                currency: booking.currency,
                amount,
                captured_amount: amount,
                refunded_amount: 0,
                provider: input.provider ?? null,
                transaction_id: input.transaction_id ?? null,
                receipt_url: input.receipt_url ?? null,
                notes: input.notes?.trim() || null,
                created_by_user_id: actor.userId,
            });

            const paymentSnapshot = await manager.getRepository(BookingPayment).find({
                where: { booking_id: resolvedBookingId },
                order: { created_at: "DESC" },
            });
            const previousPaymentStatus = booking.payment_status;
            const previousBookingStatus = booking.booking_status;
            booking.payment_status = this.computeBookingPaymentStatus(
                Number(booking.total_amount),
                paymentSnapshot,
            );
            let autoConfirmed = false;
            if (
                booking.source === BookingSource.CUSTOMER_WEB
                && booking.booking_status === HotelBookingStatus.PENDING
                && booking.payment_status === BookingPaymentStatus.PAID
                && await this.shouldAutoConfirmPaidBooking(manager, booking.listing_id)
            ) {
                booking.booking_status = HotelBookingStatus.CONFIRMED;
                booking.confirmed_by_user_id = actor.userId;
                booking.confirmed_at = new Date();
                autoConfirmed = true;
            }
            await manager.getRepository(HotelBooking).update(
                { id: resolvedBookingId },
                {
                    payment_status: booking.payment_status,
                    booking_status: booking.booking_status,
                    confirmed_by_user_id: booking.confirmed_by_user_id ?? null,
                    confirmed_at: booking.confirmed_at ?? null,
                },
            );

            await this.statusHistoryService.record({
                booking_id: resolvedBookingId,
                status_type: BookingStatusType.PAYMENT,
                from_status: previousPaymentStatus,
                to_status: booking.payment_status,
                changed_by_user_id: actor.userId,
                metadata: {
                    payment_id: paymentId || null,
                    amount,
                    transaction_id: input.transaction_id ?? null,
                },
            }, manager);

            if (autoConfirmed) {
                await this.statusHistoryService.record({
                    booking_id: resolvedBookingId,
                    status_type: BookingStatusType.BOOKING,
                    from_status: previousBookingStatus,
                    to_status: HotelBookingStatus.CONFIRMED,
                    changed_by_user_id: actor.userId,
                    metadata: {
                        auto_confirm_paid_bookings: true,
                        triggered_by_payment: true,
                    },
                }, manager);

                await this.auditService.record({
                    booking_id: resolvedBookingId,
                    event_type: "booking_auto_confirmed",
                    actor_user_id: actor.userId,
                    actor_role: BookingAuditActorRole.VENDOR,
                    source: "vendor",
                    before_state: { booking_status: previousBookingStatus },
                    after_state: { booking_status: HotelBookingStatus.CONFIRMED },
                    metadata: {
                        payment_id: paymentId || null,
                        auto_confirm_paid_bookings: true,
                    },
                }, manager);
            }

            await this.auditService.record({
                booking_id: resolvedBookingId,
                event_type: "booking_payment_recorded_by_vendor",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.VENDOR,
                source: "vendor",
                before_state: {
                    payment_status: previousPaymentStatus,
                    outstanding_amount: outstandingAmount,
                },
                after_state: {
                    payment_status: booking.payment_status,
                    outstanding_amount: this.computeOutstandingAmount(
                        Number(booking.total_amount),
                        paymentSnapshot,
                    ),
                },
                metadata: {
                    payment_id: paymentId || null,
                    amount,
                    payment_method: input.payment_method ?? null,
                },
            }, manager);

            await this.publishBookingEvent(
                booking as HotelBooking & { listing: Listing },
                "booking_payment_recorded_by_vendor",
                manager,
            );

            return this.getBookingById(resolvedBookingId, actor, "vendor", manager);
        });
        if (booking.booking_status === HotelBookingStatus.CONFIRMED) {
            await this.notifyBookingLifecycle(booking.id, "confirmed", input.notes ?? null);
        } else {
            await this.notifyBookingLifecycle(booking.id, "payment_recorded", input.notes ?? null);
        }
        return booking;
    }

    async getAvailability(
        listingId: string,
        roomTypeId: string,
        checkInDate: string,
        checkOutDate: string,
    ): Promise<IHotelAvailabilityDTO> {
        this.assertUuid(listingId, "listing_id");
        this.assertUuid(roomTypeId, "room_type_id");
        this.parseDate(checkInDate, "check_in_date");
        this.parseDate(checkOutDate, "check_out_date");

        const roomType = await this.roomTypeRepo.findOne({
            where: { id: roomTypeId, listing_id: listingId },
            relations: ["listing"],
        });

        if (!roomType) {
            throw new AppError("Room type not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (!roomType.is_active) {
            return {
                listing_id: listingId,
                room_type_id: roomTypeId,
                total_rooms: roomType.total_rooms,
                reserved_rooms: 0,
                held_rooms: 0,
                available_rooms: 0,
                check_in_date: checkInDate,
                check_out_date: checkOutDate,
            };
        }

        const reservedRooms = await this.getReservedRoomCount(
            AppDataSource.manager,
            roomTypeId,
            checkInDate,
            checkOutDate,
        );

        const heldRooms = await this.getActiveHoldRoomCount(
            AppDataSource.manager,
            roomTypeId,
            checkInDate,
            checkOutDate,
        );

        return {
            listing_id: listingId,
            room_type_id: roomTypeId,
            total_rooms: roomType.total_rooms,
            reserved_rooms: reservedRooms,
            held_rooms: heldRooms,
            available_rooms: Math.max(roomType.total_rooms - reservedRooms - heldRooms, 0),
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
        };
    }

    async createCustomerHold(
        actor: AuthActor,
        dto: ICreateHotelBookingHoldDTO,
    ): Promise<IBookingHoldDTO> {
        if (actor.userType !== UserRole.CUSTOMER) {
            throw new AppError("Only customers can place booking holds", 403, ErrorCodes.FORBIDDEN);
        }

        this.validateHoldInput(dto);

        return AppDataSource.transaction(async (manager) => {
            await this.expireStaleHolds(manager);
            const roomType = await this.loadLockedRoomType(manager, dto.room_type_id);

            if (roomType.listing_id !== dto.listing_id) {
                throw new AppError(
                    "The selected room type does not belong to the requested hotel",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            if (!roomType.is_active) {
                throw new AppError(
                    "This room type is currently in maintenance",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            if (!roomType.listing.is_active) {
                throw new AppError(
                    "This hotel is not available for online booking",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            if (dto.guest_count > roomType.capacity * dto.rooms_count) {
                throw new AppError(
                    "Guest count exceeds the selected room capacity",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const reservedRooms = await this.getReservedRoomCount(
                manager,
                dto.room_type_id,
                dto.check_in_date,
                dto.check_out_date,
            );
            const heldRooms = await this.getActiveHoldRoomCount(
                manager,
                dto.room_type_id,
                dto.check_in_date,
                dto.check_out_date,
            );
            const availableRooms = roomType.total_rooms - reservedRooms - heldRooms;

            if (dto.rooms_count > availableRooms) {
                throw new AppError(
                    `Only ${Math.max(availableRooms, 0)} room(s) are available for the selected dates`,
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const existingActiveHolds = await manager.getRepository(BookingRoomHold)
                .createQueryBuilder("hold")
                .innerJoinAndSelect("hold.listing", "listing")
                .where("hold.customer_user_id = :customerUserId", { customerUserId: actor.userId })
                .andWhere("hold.status = :status", { status: BookingHoldStatus.ACTIVE })
                .andWhere("hold.expires_at > NOW()")
                .getMany();

            if (existingActiveHolds.length > 0) {
                await manager.getRepository(BookingRoomHold)
                    .createQueryBuilder()
                    .update(BookingRoomHold)
                    .set({
                        status: BookingHoldStatus.RELEASED,
                        released_at: () => "NOW()",
                    })
                    .where("id IN (:...ids)", { ids: existingActiveHolds.map((hold) => hold.id) })
                    .execute();

                for (const hold of existingActiveHolds) {
                    await this.publishHoldEvent(
                        hold as BookingRoomHold & { listing: Listing },
                        "hold_released_by_new_hold",
                        manager,
                    );
                }
            }

            const hold = manager.getRepository(BookingRoomHold).create({
                customer_user_id: actor.userId,
                listing_id: dto.listing_id,
                room_type_id: dto.room_type_id,
                rooms_count: dto.rooms_count,
                guest_count: dto.guest_count,
                check_in_date: dto.check_in_date,
                check_out_date: dto.check_out_date,
                status: BookingHoldStatus.ACTIVE,
                expires_at: new Date(Date.now() + this.holdDurationMs),
            });

            const savedHold = await manager.getRepository(BookingRoomHold).save(hold);
            await this.publishHoldEvent(
                {
                    ...savedHold,
                    listing: roomType.listing,
                } as BookingRoomHold & { listing: Listing },
                "hold_created",
                manager,
            );
            return this.toHoldDTO(savedHold);
        });
    }

    async releaseExpiredHolds(): Promise<number> {
        return this.expireStaleHolds();
    }

    async getBookedDatesForRoomType(roomTypeId: string): Promise<Array<{ start: string; end: string }>> {
        this.assertUuid(roomTypeId, "room_type_id");

        const bookings = await this.bookingRepo.createQueryBuilder("booking")
            .select(["booking.check_in_date", "booking.check_out_date"])
            .where("booking.room_type_id = :roomTypeId", { roomTypeId })
            .andWhere("booking.booking_status IN (:...activeStatuses)", {
                activeStatuses: ACTIVE_BOOKING_STATUSES,
            })
            .andWhere("booking.check_out_date > CURRENT_DATE")
            .orderBy("booking.check_in_date", "ASC")
            .getMany();

        return bookings.map((booking) => ({
            start: booking.check_in_date,
            end: booking.check_out_date,
        }));
    }
}
