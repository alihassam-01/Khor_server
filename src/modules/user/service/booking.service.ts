import { CONFIG } from "@config/config";
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
    ICreateHotelBookingRoomAllocationDTO,
    ICreateHotelBookingHoldDTO,
    ICreateHotelBookingDTO,
    IHotelAvailabilityDTO,
    IHotelBookingDTO,
    IHotelBookingCheckoutResponseDTO,
    IHotelBookingListResponseDTO,
    IRecordBookingPaymentDTO,
    IBookingRefundDTO,
    IBookingRefundListResponseDTO,
    IRefundRequestDTO,
} from "@modules/user/dtos";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { isValidUuid } from "@common/utils/uuid.util";
import { logInfo, logWarn } from "@lib/logger";
import { BookingAuditService } from "./booking-audit.service";
import { BookingStatusHistoryService } from "./booking-status-history.service";
import { bookingRealtimeService } from "./booking-realtime.service";
import { SendEmail } from "./email/sendEmail";
import { pickBestPromotion } from "./listing/hotel-promotion.util";
import { NotificationService, type NotificationPayload } from "./notification.service";
import { NotificationOutboxService } from "./notification-outbox.service";
import { PayFastService } from "./payfast.service";

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

type RefundPolicySnapshot = {
    cancellationPolicy: string | null;
    refundCutoffHours: number | null;
};

type RefundEligibilityResult = {
    eligible: boolean;
    message: string | null;
    refundCutoffHours: number | null;
    cancellationPolicy: string | null;
    source: "snapshot" | "current";
};

type NormalizedBookingAllocation = {
    room_type_id: string;
    rooms_count: number;
};

export class BookingService {
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly roomTypeRepo = AppDataSource.getRepository(HotelRoomType);
    private readonly refundRepo = AppDataSource.getRepository(BookingRefund);
    private readonly auditService = new BookingAuditService();
    private readonly statusHistoryService = new BookingStatusHistoryService();
    private readonly emailService = new SendEmail();
    private readonly notificationService = new NotificationService();
    private readonly notificationOutboxService = new NotificationOutboxService();
    private readonly payFastService = new PayFastService();
    private readonly holdDurationMs = 10 * 60 * 1000;

    private isDevelopmentEnv(): boolean {
        return CONFIG.env === "development";
    }

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

    private async getHotelRefundPolicySnapshot(
        manager: EntityManager,
        listingId: string,
    ): Promise<RefundPolicySnapshot> {
        const details = await manager.getRepository(HotelDetails).findOne({
            where: { listing_id: listingId },
            select: ["listing_id", "refund_cutoff_hours", "cancellation_policy"],
        });

        return {
            cancellationPolicy: details?.cancellation_policy?.trim() || null,
            refundCutoffHours: details?.refund_cutoff_hours == null
                ? null
                : Math.max(0, Number(details.refund_cutoff_hours)),
        };
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

    private async getRefundEligibility(
        manager: EntityManager,
        booking: HotelBooking,
    ): Promise<RefundEligibilityResult> {
        const snapshotCutoff = booking.refund_cutoff_hours_snapshot != null
            ? Math.max(0, Number(booking.refund_cutoff_hours_snapshot))
            : null;
        const snapshotPolicy = booking.cancellation_policy_snapshot?.trim() || null;

        let cutoffHours = snapshotCutoff;
        let cancellationPolicy = snapshotPolicy;
        let source: "snapshot" | "current" = "snapshot";

        if (cutoffHours == null && !cancellationPolicy) {
            const livePolicy = await this.getHotelRefundPolicySnapshot(manager, booking.listing_id);
            cutoffHours = livePolicy.refundCutoffHours;
            cancellationPolicy = livePolicy.cancellationPolicy;
            source = "current";
        }

        if (cutoffHours == null) {
            return {
                eligible: true,
                message: null,
                refundCutoffHours: null,
                cancellationPolicy,
                source,
            };
        }

        if (cutoffHours === 0) {
            return {
                eligible: false,
                message: "This booking is not eligible for a refund under the hotel policy.",
                refundCutoffHours: 0,
                cancellationPolicy,
                source,
            };
        }

        const deadline = this.getRefundEligibilityDeadline(booking.check_in_date, cutoffHours);
        if (Date.now() > deadline.getTime()) {
            return {
                eligible: false,
                message: `This booking is outside the refund window. The policy requires cancellation at least ${cutoffHours} hour(s) before check-in.`,
                refundCutoffHours: cutoffHours,
                cancellationPolicy,
                source,
            };
        }

        return {
            eligible: true,
            message: `Refund request created under the booking policy snapshot (${cutoffHours} hour(s) before check-in).`,
            refundCutoffHours: cutoffHours,
            cancellationPolicy,
            source,
        };
    }

    private async assertRefundRequestAllowed(
        manager: EntityManager,
        booking: HotelBooking,
    ): Promise<void> {
        const eligibility = await this.getRefundEligibility(manager, booking);
        if (eligibility.eligible) {
            return;
        }

        throw new AppError(
            eligibility.message || "Refund requests are not available for this booking.",
            409,
            ErrorCodes.CONFLICT,
        );
    }

    private normalizeBookingAllocations(dto: ICreateHotelBookingDTO): NormalizedBookingAllocation[] {
        const rawAllocations = Array.isArray(dto.room_allocations) && dto.room_allocations.length > 0
            ? dto.room_allocations
            : [{ room_type_id: dto.room_type_id, rooms_count: dto.rooms_count }];

        const merged = new Map<string, number>();
        for (const allocation of rawAllocations as ICreateHotelBookingRoomAllocationDTO[]) {
            const roomTypeId = allocation.room_type_id;
            const roomsCount = Number(allocation.rooms_count);
            this.assertUuid(roomTypeId, "room_allocations.room_type_id");
            if (!Number.isInteger(roomsCount) || roomsCount <= 0) {
                throw new AppError(
                    "room_allocations.rooms_count must be a positive integer",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }
            merged.set(roomTypeId, (merged.get(roomTypeId) ?? 0) + roomsCount);
        }

        return Array.from(merged.entries()).map(([room_type_id, rooms_count]) => ({
            room_type_id,
            rooms_count,
        }));
    }

    private validateCreateInput(dto: ICreateHotelBookingDTO): void {
        this.assertUuid(dto.listing_id, "listing_id");
        this.assertUuid(dto.room_type_id, "room_type_id");
        if (dto.hold_id) {
            this.assertUuid(dto.hold_id, "hold_id");
        }
        for (const holdId of dto.hold_ids ?? []) {
            this.assertUuid(holdId, "hold_ids");
        }
        const allocations = this.normalizeBookingAllocations(dto);
        if (allocations.length === 0) {
            throw new AppError("At least one room allocation is required", 400, ErrorCodes.VALIDATION_ERROR);
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

    private isDeferredPayFastCheckout(
        dto: ICreateHotelBookingDTO,
        source: BookingSource,
    ): boolean {
        return source === BookingSource.CUSTOMER_WEB && dto.payment_provider === "payfast_redirect";
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
        excludeHoldId?: string | string[],
    ): Promise<number> {
        const qb = manager.getRepository(BookingRoomHold)
            .createQueryBuilder("hold")
            .select("COALESCE(SUM(hold.rooms_count), 0)", "held_rooms")
            .where("hold.room_type_id = :roomTypeId", { roomTypeId })
            .andWhere("hold.status = :status", { status: BookingHoldStatus.ACTIVE })
            .andWhere("hold.expires_at > NOW()")
            .andWhere("hold.check_in_date < :checkOutDate", { checkOutDate })
            .andWhere("hold.check_out_date > :checkInDate", { checkInDate });

        const excludeHoldIds = Array.isArray(excludeHoldId)
            ? excludeHoldId.filter(Boolean)
            : excludeHoldId
                ? [excludeHoldId]
                : [];
        if (excludeHoldIds.length > 0) {
            qb.andWhere("hold.id NOT IN (:...excludeHoldIds)", { excludeHoldIds });
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

    private async expireStalePendingPayments(manager: EntityManager = AppDataSource.manager): Promise<number> {
        const stalePayments = await manager.getRepository(BookingPayment)
            .createQueryBuilder("payment")
            .innerJoinAndSelect("payment.booking", "booking")
            .where("payment.payment_status = :status", { status: BookingPaymentStatus.PENDING })
            .andWhere("booking.booking_status = :bookingStatus", { bookingStatus: HotelBookingStatus.PENDING })
            .andWhere("(payment.provider = :provider OR payment.provider = :redirectProvider)", {
                provider: "payfast",
                redirectProvider: "payfast_redirect",
            })
            .andWhere("payment.metadata ->> 'checkout_mode' = :checkoutMode", { checkoutMode: "payfast_redirect" })
            .andWhere("(payment.metadata ->> 'expires_at') IS NOT NULL")
            .andWhere("((payment.metadata ->> 'expires_at')::timestamptz) <= NOW()")
            .getMany();

        if (stalePayments.length === 0) {
            return 0;
        }

        for (const payment of stalePayments) {
            payment.payment_status = BookingPaymentStatus.EXPIRED;
            payment.metadata = this.mergePaymentMetadata(payment, {
                checkout_status: "expired",
                expired_at: new Date().toISOString(),
            });
            await manager.getRepository(BookingPayment).save(payment);

            if (payment.booking.payment_status === BookingPaymentStatus.PENDING) {
                payment.booking.payment_status = BookingPaymentStatus.EXPIRED;
                await manager.getRepository(HotelBooking).save(payment.booking);

                await this.statusHistoryService.record({
                    booking_id: payment.booking.id,
                    status_type: BookingStatusType.PAYMENT,
                    from_status: BookingPaymentStatus.PENDING,
                    to_status: BookingPaymentStatus.EXPIRED,
                    changed_by_user_id: null,
                    metadata: {
                        provider: "payfast",
                        reason: "checkout_expired",
                    },
                }, manager);
            }

            await this.auditService.record({
                booking_id: payment.booking.id,
                event_type: "booking_payment_expired",
                actor_role: BookingAuditActorRole.SYSTEM,
                source: "payfast",
                after_state: {
                    booking_status: payment.booking.booking_status,
                    payment_status: BookingPaymentStatus.EXPIRED,
                },
                metadata: {
                    provider: "payfast",
                    payment_id: payment.id,
                },
            }, manager);
        }

        return stalePayments.length;
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
            booking_cancelled_by_customer: {
                category: "booking",
                customerTitle: "Booking cancelled",
                customerMessage: `Your booking for ${roomName} at ${hotelName} has been cancelled.`,
                vendorTitle: "Booking cancelled",
                vendorMessage: `A customer cancelled the booking for ${roomName}.`,
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

        const shouldNotifyVendor =
            booking.source !== BookingSource.CUSTOMER_WEB
            || booking.payment_status === BookingPaymentStatus.PAID;

        if (booking.listing.vendor_id && shouldNotifyVendor) {
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
        await this.notificationOutboxService.enqueueBookingLifecycle(manager, booking.id, action);
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
            const allocations = this.normalizeBookingAllocations(dto);
            const primaryAllocation = allocations[0];
            const lockedRoomTypes = new Map<string, HotelRoomType & { listing: Listing }>();
            for (const allocation of [...allocations].sort((a, b) => a.room_type_id.localeCompare(b.room_type_id))) {
                lockedRoomTypes.set(
                    allocation.room_type_id,
                    await this.loadLockedRoomType(manager, allocation.room_type_id),
                );
            }
            const roomType = lockedRoomTypes.get(primaryAllocation.room_type_id);
            if (!roomType) {
                throw new AppError("Room type not found", 404, ErrorCodes.NOT_FOUND);
            }

            for (const allocation of allocations) {
                const allocatedRoomType = lockedRoomTypes.get(allocation.room_type_id);
                if (!allocatedRoomType || allocatedRoomType.listing_id !== dto.listing_id) {
                    throw new AppError(
                        "All selected room types must belong to the requested hotel",
                        400,
                        ErrorCodes.VALIDATION_ERROR,
                    );
                }

                if (!allocatedRoomType.is_active) {
                    throw new AppError(
                        `${allocatedRoomType.name} is currently in maintenance`,
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }
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

            const totalRoomsCount = allocations.reduce((sum, allocation) => sum + allocation.rooms_count, 0);
            const totalGuestCapacity = allocations.reduce((sum, allocation) => {
                const allocatedRoomType = lockedRoomTypes.get(allocation.room_type_id);
                return sum + Number(allocatedRoomType?.capacity ?? 0) * allocation.rooms_count;
            }, 0);

            if (dto.guest_count > totalGuestCapacity) {
                throw new AppError(
                    "Guest count exceeds the selected room capacity",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            const holds: BookingRoomHold[] = [];
            const holdIds = Array.from(new Set([...(dto.hold_ids ?? []), dto.hold_id].filter(Boolean) as string[]));
            const holdsByRoomTypeId = new Map<string, BookingRoomHold[]>();

            if (source === BookingSource.CUSTOMER_WEB) {
                if (holdIds.length === 0) {
                    throw new AppError(
                        "A valid room hold is required before completing checkout",
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }

                for (const holdId of holdIds) {
                    const hold = await this.loadLockedActiveHold(manager, holdId, actor.userId);
                    holds.push(hold);
                    holdsByRoomTypeId.set(hold.room_type_id, [...(holdsByRoomTypeId.get(hold.room_type_id) ?? []), hold]);
                }

                const allHoldsMatch = allocations.every((allocation) => {
                    const allocationHolds = holdsByRoomTypeId.get(allocation.room_type_id) ?? [];
                    const heldRoomsCount = allocationHolds.reduce((sum, hold) => sum + hold.rooms_count, 0);
                    return allocationHolds.length > 0
                        && heldRoomsCount === allocation.rooms_count
                        && allocationHolds.every((hold) => hold.listing_id === dto.listing_id
                            && hold.check_in_date === dto.check_in_date
                            && hold.check_out_date === dto.check_out_date);
                });

                if (!allHoldsMatch) {
                    throw new AppError(
                        "The booking details do not match the active room hold",
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }
            }

            for (const allocation of allocations) {
                const allocatedRoomType = lockedRoomTypes.get(allocation.room_type_id);
                const reservedRooms = await this.getReservedRoomCount(
                    manager,
                    allocation.room_type_id,
                    dto.check_in_date,
                    dto.check_out_date,
                );
                const heldRooms = await this.getActiveHoldRoomCount(
                    manager,
                    allocation.room_type_id,
                    dto.check_in_date,
                    dto.check_out_date,
                    (holdsByRoomTypeId.get(allocation.room_type_id) ?? []).map((hold) => hold.id),
                );
                const availableRooms = Number(allocatedRoomType?.total_rooms ?? 0) - reservedRooms - heldRooms;

                if (allocation.rooms_count > availableRooms) {
                    throw new AppError(
                        `Only ${Math.max(availableRooms, 0)} ${allocatedRoomType?.name ?? "room"} room(s) are available for the selected dates`,
                        409,
                        ErrorCodes.CONFLICT,
                    );
                }
            }

            const nights = this.calculateNights(dto.check_in_date, dto.check_out_date);
            const refundPolicySnapshot = await this.getHotelRefundPolicySnapshot(manager, dto.listing_id);
            let subtotal = 0;
            let discountAmount = 0;
            let nightlyRateSnapshot = 0;
            const promotionIds = new Set<string>();
            for (const allocation of allocations) {
                const allocatedRoomType = lockedRoomTypes.get(allocation.room_type_id) as HotelRoomType;
                const baseNightlyRate = Number(allocatedRoomType.price);
                const activePromotion = await this.getActivePromotionForRoomType(
                    manager,
                    dto.listing_id,
                    allocatedRoomType,
                );
                const nightlyRate = this.roundAmount(activePromotion?.discounted_price ?? baseNightlyRate);
                if (allocation.room_type_id === primaryAllocation.room_type_id) {
                    nightlyRateSnapshot = nightlyRate;
                }
                subtotal += baseNightlyRate * allocation.rooms_count * nights;
                discountAmount += (baseNightlyRate - nightlyRate) * allocation.rooms_count * nights;
                if (activePromotion?.id) promotionIds.add(activePromotion.id);
            }
            subtotal = this.roundAmount(subtotal);
            discountAmount = this.roundAmount(discountAmount);
            const totalAmount = this.roundAmount(subtotal - discountAmount);
            const requestedDevelopmentDirectCheckout = source === BookingSource.CUSTOMER_WEB
                && this.isDevelopmentEnv()
                && dto.payment_provider === "development_direct";
            const initialPaymentAmount = requestedDevelopmentDirectCheckout
                ? totalAmount
                : this.roundAmount(dto.payment_amount ?? 0);
            const isDeferredPayFastCheckout = this.isDeferredPayFastCheckout(dto, source);
            const isDevelopmentDirectCheckout = source === BookingSource.CUSTOMER_WEB
                && requestedDevelopmentDirectCheckout
                && !isDeferredPayFastCheckout
                && totalAmount > 0;

            if (isDeferredPayFastCheckout && initialPaymentAmount !== 0) {
                throw new AppError(
                    "PayFast checkout sessions must start without a captured payment amount.",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }

            if (source === BookingSource.CUSTOMER_WEB && !isDeferredPayFastCheckout && !isDevelopmentDirectCheckout) {
                throw new AppError(
                    "Online bookings must be paid through a verified checkout session.",
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

            const initialBookingPaymentStatus = isDeferredPayFastCheckout
                ? BookingPaymentStatus.PENDING
                : initialPaymentAmount <= 0
                ? BookingPaymentStatus.PENDING
                : initialPaymentAmount < totalAmount
                    ? BookingPaymentStatus.PARTIALLY_PAID
                    : BookingPaymentStatus.PAID;
            const shouldAutoConfirmCustomerBooking = source === BookingSource.CUSTOMER_WEB
                && !isDeferredPayFastCheckout
                && initialBookingPaymentStatus === BookingPaymentStatus.PAID
                && (
                    isDevelopmentDirectCheckout
                    || await this.shouldAutoConfirmPaidBooking(manager, dto.listing_id)
                );

            const booking = manager.getRepository(HotelBooking).create({
                source,
                customer_user_id: source === BookingSource.CUSTOMER_WEB ? actor.userId : null,
                guest_name: dto.guest_name.trim(),
                guest_email: dto.guest_email.trim().toLowerCase(),
                guest_phone: dto.guest_phone.trim(),
                listing_id: dto.listing_id,
                room_type_id: primaryAllocation.room_type_id,
                rooms_count: totalRoomsCount,
                guest_count: dto.guest_count,
                check_in_date: dto.check_in_date,
                check_out_date: dto.check_out_date,
                nights,
                currency: "PKR",
                nightly_rate_snapshot: nightlyRateSnapshot,
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
                cancellation_policy_snapshot: refundPolicySnapshot.cancellationPolicy,
                refund_cutoff_hours_snapshot: refundPolicySnapshot.refundCutoffHours,
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
            if (!isDeferredPayFastCheckout) {
                const bookingAllocations = allocations.map((allocation) => manager.getRepository(HotelBookingAllocation).create({
                    booking_id: savedBooking.id,
                    listing_id: dto.listing_id,
                    room_type_id: allocation.room_type_id,
                    quantity_reserved: allocation.rooms_count,
                }));
                await manager.getRepository(HotelBookingAllocation).save(bookingAllocations);
            }

            for (const promotionId of promotionIds) {
                await manager.getRepository(HotelPromotion).increment(
                    { id: promotionId },
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
                    provider: dto.payment_provider ?? (isDevelopmentDirectCheckout ? "development_direct" : null),
                    transaction_id: dto.transaction_id ?? (isDevelopmentDirectCheckout ? `dev-booking-${savedBooking.id}` : null),
                    notes: dto.payment_notes?.trim() || (isDevelopmentDirectCheckout
                        ? "Development-mode direct booking payment bypass"
                        : null),
                    metadata: isDevelopmentDirectCheckout
                        ? { checkout_mode: "development_direct_bypass" }
                        : undefined,
                    created_by_user_id: actor.userId,
                });
            } else if (isDeferredPayFastCheckout) {
                await this.insertBookingPayment(manager, {
                    booking_id: savedBooking.id,
                    payment_method: null,
                    payment_status: BookingPaymentStatus.PENDING,
                    currency: savedBooking.currency,
                    amount: totalAmount,
                    captured_amount: 0,
                    refunded_amount: 0,
                    provider: "payfast_redirect",
                    notes: dto.payment_notes?.trim() || "Pending PayFast checkout",
                    metadata: {
                        checkout_mode: "payfast_redirect",
                        hold_id: holdIds[0] ?? null,
                        hold_ids: holdIds,
                        room_allocations: allocations,
                    },
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

            if (holds.length > 0 && !isDeferredPayFastCheckout) {
                for (const hold of holds) {
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
                    room_type_id: primaryAllocation.room_type_id,
                    rooms_count: totalRoomsCount,
                    room_allocations: allocations,
                    guest_count: dto.guest_count,
                    payment_amount: initialPaymentAmount,
                    payment_mode: isDeferredPayFastCheckout
                        ? "payfast_redirect"
                        : isDevelopmentDirectCheckout
                            ? "development_direct_bypass"
                            : "direct_capture",
                    hold_id: holdIds[0] ?? null,
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
        if (booking.payment_status === BookingPaymentStatus.PAID) {
            await this.notifyBookingLifecycle(
                booking.id,
                booking.booking_status === HotelBookingStatus.CONFIRMED ? "confirmed" : "created",
            );
        }
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
            .leftJoinAndSelect("booking.allocations", "allocations")
            .leftJoinAndSelect("allocations.room_type", "allocation_room_type")
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

    private async loadBookingForGateway(
        bookingId: string,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<HotelBooking> {
        this.assertUuid(bookingId, "booking id");

        const booking = await manager.getRepository(HotelBooking)
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.location", "listing_location")
            .leftJoinAndSelect("listing.contact", "listing_contact")
            .leftJoinAndSelect("listing.hotel_details", "listing_hotel_details")
            .leftJoinAndSelect("listing.media", "listing_media")
            .leftJoinAndSelect("listing.vendor", "listing_vendor")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .leftJoinAndSelect("booking.allocations", "allocations")
            .leftJoinAndSelect("allocations.room_type", "allocation_room_type")
            .leftJoinAndSelect("booking.payments", "payments")
            .leftJoinAndSelect("booking.refunds", "refunds")
            .where("booking.id = :bookingId", { bookingId })
            .orderBy("payments.created_at", "DESC")
            .addOrderBy("refunds.created_at", "DESC")
            .getOne();

        if (!booking) {
            throw new AppError("Booking not found", 404, ErrorCodes.NOT_FOUND);
        }
        return booking;
    }

    private getLatestPayFastPayment(booking: HotelBooking): BookingPayment | null {
        const payments = [...(booking.payments ?? [])]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return payments.find((payment) => {
            const provider = String(payment.provider ?? "").toLowerCase();
            const mode = String((payment.metadata as Record<string, unknown> | null)?.checkout_mode ?? "").toLowerCase();
            return provider === "payfast" || provider === "payfast_redirect" || mode === "payfast_redirect";
        }) ?? null;
    }

    private buildPayFastReturnUrl(result: "success" | "failure", bookingId: string): string {
        const apiBase = this.isDevelopmentEnv()
            ? `http://${CONFIG.server.host || "127.0.0.1"}:${CONFIG.server.port || 3008}`
            : (
                CONFIG.api_domain.url ||
                `http://${CONFIG.server.host || "127.0.0.1"}:${CONFIG.server.port || 3008}`
            );
        const base = `${apiBase}/api/payments/payfast/return/${result}`;
        return `${base}?booking_id=${encodeURIComponent(bookingId)}`;
    }

    private buildPayFastFrontendStatusUrl(bookingId: string, status?: string): string {
        const webBase = this.isDevelopmentEnv()
            ? (CONFIG.web_domain.url || "http://localhost:9002")
            : (CONFIG.web_domain.url || "http://localhost:9002");
        const base = `${webBase}/payment/result`;
        const params = new URLSearchParams({ bookingId });
        if (status) params.set("status", status);
        return `${base}?${params.toString()}`;
    }

    private mergePaymentMetadata(
        payment: BookingPayment,
        extra: Record<string, unknown>,
    ): Record<string, unknown> {
        return {
            ...((payment.metadata as Record<string, unknown> | null) ?? {}),
            ...extra,
        };
    }

    private getPaymentCheckoutExpiry(payment?: BookingPayment | null): Date | null {
        const raw = (payment?.metadata as Record<string, unknown> | null)?.expires_at;
        if (!raw) return null;

        const parsed = new Date(String(raw));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private isDeferredPayFastPayment(payment?: BookingPayment | null): boolean {
        if (!payment) return false;
        const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
        const provider = String(payment.provider ?? "").toLowerCase();
        const checkoutMode = String(metadata.checkout_mode ?? "").toLowerCase();

        return provider === "payfast" || provider === "payfast_redirect" || checkoutMode === "payfast_redirect";
    }

    private isCheckoutExpiredForBooking(booking: HotelBooking, payment?: BookingPayment | null): boolean {
        if (booking.booking_status !== HotelBookingStatus.PENDING) return false;
        if (![BookingPaymentStatus.PENDING, BookingPaymentStatus.EXPIRED].includes(booking.payment_status)) return false;
        if (!this.isDeferredPayFastPayment(payment)) return false;

        if (booking.payment_status === BookingPaymentStatus.EXPIRED || payment?.payment_status === BookingPaymentStatus.EXPIRED) {
            return true;
        }

        const expiresAt = this.getPaymentCheckoutExpiry(payment);
        return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
    }

    private canResumePaymentForBooking(booking: HotelBooking, payment?: BookingPayment | null): boolean {
        if (booking.booking_status !== HotelBookingStatus.PENDING) return false;
        if (booking.payment_status !== BookingPaymentStatus.PENDING) return false;
        if (!this.isDeferredPayFastPayment(payment)) return false;

        return !this.isCheckoutExpiredForBooking(booking, payment);
    }

    private requiresManualReview(booking: HotelBooking, payment?: BookingPayment | null): boolean {
        const metadata = (payment?.metadata as Record<string, unknown> | null) ?? {};
        return booking.payment_status === BookingPaymentStatus.PAID && metadata.manual_review_required === true;
    }

    private getPaymentIssue(booking: HotelBooking, payment?: BookingPayment | null): string | null {
        const metadata = (payment?.metadata as Record<string, unknown> | null) ?? {};
        if (this.requiresManualReview(booking, payment)) {
            return String(metadata.payment_issue ?? "inventory_unavailable_after_payment");
        }
        return null;
    }

    private getBookingChannel(source: BookingSource): "web" | "manual" {
        return source === BookingSource.PARTNER_MANUAL ? "manual" : "web";
    }

    private toDTO(booking: HotelBooking): IHotelBookingDTO {
        const latestPayFastPayment = this.getLatestPayFastPayment(booking);
        const paymentExpiresAt = this.getPaymentCheckoutExpiry(latestPayFastPayment);
        const isExpired = this.isCheckoutExpiredForBooking(booking, latestPayFastPayment);
        const roomAllocations = (booking.allocations?.length ? booking.allocations : [{
            room_type: booking.room_type,
            quantity_reserved: booking.rooms_count,
        } as HotelBookingAllocation]).map((allocation) => ({
            room_type: {
                id: allocation.room_type.id,
                name: allocation.room_type.name,
                total_rooms: allocation.room_type.total_rooms,
                capacity: allocation.room_type.capacity,
            },
            rooms_count: Number(allocation.quantity_reserved),
            nightly_rate: Number(allocation.room_type.price ?? booking.nightly_rate_snapshot),
        }));

        return {
            id: booking.id,
            booking_number: booking.booking_number,
            source: booking.source,
            channel: this.getBookingChannel(booking.source),
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
                cancellation_policy: booking.cancellation_policy_snapshot
                    ?? booking.listing.hotel_details?.cancellation_policy
                    ?? null,
                refund_cutoff_hours: booking.refund_cutoff_hours_snapshot
                    ?? booking.listing.hotel_details?.refund_cutoff_hours
                    ?? null,
                check_in_time: booking.listing.hotel_details?.check_in_time ?? null,
                check_out_time: booking.listing.hotel_details?.check_out_time ?? null,
            },
            room_type: {
                id: booking.room_type.id,
                name: booking.room_type.name,
                total_rooms: booking.room_type.total_rooms,
                capacity: booking.room_type.capacity,
            },
            room_allocations: roomAllocations,
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
            display_status: isExpired ? "expired" : booking.booking_status,
            payment_status: booking.payment_status,
            can_resume_payment: this.canResumePaymentForBooking(booking, latestPayFastPayment),
            payment_expires_at: paymentExpiresAt,
            requires_manual_review: this.requiresManualReview(booking, latestPayFastPayment),
            payment_issue: this.getPaymentIssue(booking, latestPayFastPayment),
            cancellation_status: booking.cancellation_status,
            refund_status: booking.refund_status,
            cancellation_policy_snapshot: booking.cancellation_policy_snapshot ?? null,
            refund_cutoff_hours_snapshot: booking.refund_cutoff_hours_snapshot ?? null,
            special_requests: booking.special_requests ?? null,
            cancellation_refund: null,
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
                metadata: refund.metadata ?? null,
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
            booking_cancelled_by_customer: "Booking cancelled by customer",
            booking_payment_expired: "Payment expired",
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

    private async releaseCheckoutHoldIfPresent(
        manager: EntityManager,
        booking: HotelBooking,
    ): Promise<void> {
        const payment = this.getLatestPayFastPayment(booking);
        const metadata = (payment?.metadata as Record<string, unknown> | null) ?? {};
        const holdIds = Array.isArray(metadata.hold_ids)
            ? (metadata.hold_ids as unknown[]).map((value) => String(value)).filter((value) => isValidUuid(value))
            : [];
        const holdId = String(metadata.hold_id ?? "");
        if (holdId && isValidUuid(holdId) && !holdIds.includes(holdId)) {
            holdIds.push(holdId);
        }
        if (holdIds.length === 0) {
            return;
        }

        const holds = await manager.getRepository(BookingRoomHold).find({
            where: holdIds.map((id) => ({ id })),
            relations: ["listing"],
        });

        for (const hold of holds) {
            if (hold.status !== BookingHoldStatus.ACTIVE) continue;
            hold.status = BookingHoldStatus.RELEASED;
            hold.released_at = new Date();
            await manager.getRepository(BookingRoomHold).save(hold);
        }
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
        const vendorPhone = booking.listing.contact?.phone
            ?? booking.listing.contact?.whatsapp
            ?? booking.listing.vendor?.profile?.phone_number
            ?? null;
        const customerName = booking.guest_name;
        const customerEmail = booking.guest_email;
        const customerPhone = booking.guest_phone ?? null;

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
                customerIntro: "Your cancellation request has been recorded and is waiting for review.",
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
                counterpartyPhone: vendorPhone,
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
                counterpartyPhone: customerPhone,
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
        await this.expireStalePendingPayments();

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
            .leftJoinAndSelect("booking.allocations", "allocations")
            .leftJoinAndSelect("allocations.room_type", "allocation_room_type")
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
        const updatedBooking = await AppDataSource.transaction(async (manager) => {
            const currentBooking = await this.loadBookingForActor(bookingId, actor, scope, manager);
            const previousStatus = currentBooking.booking_status;
            const previousCancellationStatus = currentBooking.cancellation_status;

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

            currentBooking.booking_status = nextStatus;
            if (nextStatus === HotelBookingStatus.CONFIRMED) {
                currentBooking.confirmed_by_user_id = actor.userId;
                currentBooking.confirmed_at = new Date();
            }
            if (nextStatus === HotelBookingStatus.CANCELLED) {
                currentBooking.cancellation_status = BookingCancellationStatus.CANCELLED;
                currentBooking.cancelled_by_user_id = actor.userId;
                currentBooking.cancelled_at = new Date();
            }
            if (nextStatus === HotelBookingStatus.COMPLETED) {
                currentBooking.completed_by_user_id = actor.userId;
                currentBooking.completed_at = new Date();
            }

            const saved = await manager.getRepository(HotelBooking).save(currentBooking);

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

        const shouldSendLifecycleNotification = updatedBooking.payment_status === BookingPaymentStatus.PAID;

        if (!shouldSendLifecycleNotification) {
            return updatedBooking;
        }

        if (nextStatus === HotelBookingStatus.CONFIRMED) {
            await this.notifyBookingLifecycle(updatedBooking.id, "confirmed", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.CANCELLED) {
            await this.notifyBookingLifecycle(updatedBooking.id, "cancelled", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.CHECKED_IN) {
            await this.notifyBookingLifecycle(updatedBooking.id, "checked_in", reason ?? null);
        } else if (nextStatus === HotelBookingStatus.COMPLETED) {
            await this.notifyBookingLifecycle(updatedBooking.id, "completed", reason ?? null);
        }

        return updatedBooking;
    }

    async createCustomerCheckout(
        actor: AuthActor,
        dto: ICreateHotelBookingDTO,
        customerIp: string,
    ): Promise<IHotelBookingCheckoutResponseDTO> {
        if (this.isDevelopmentEnv()) {
            const booking = await this.createBooking({
                ...dto,
                payment_amount: Number.MAX_SAFE_INTEGER,
                payment_method: dto.payment_method,
                payment_notes: dto.payment_notes?.trim() || "Development checkout bypass",
                payment_provider: "development_direct",
                transaction_id: dto.transaction_id ?? undefined,
            }, actor, BookingSource.CUSTOMER_WEB);

            return {
                booking_id: booking.id,
                booking_number: booking.booking_number,
                checkout_url: this.buildPayFastFrontendStatusUrl(booking.id, "success"),
                form_fields: {},
                expires_at: new Date(),
            };
        }

        const booking = await this.createBooking({
            ...dto,
            payment_amount: 0,
            payment_method: undefined,
            payment_notes: "Pending PayFast checkout",
            payment_provider: "payfast_redirect",
            transaction_id: undefined,
        }, actor, BookingSource.CUSTOMER_WEB);

        const session = await AppDataSource.transaction(async (manager) => {
            const bookingEntity = await this.loadBookingForGateway(booking.id, manager);
            const payment = this.getLatestPayFastPayment(bookingEntity);
            if (!payment) {
                throw new AppError(
                    "Pending PayFast booking payment was not created.",
                    500,
                    ErrorCodes.INTERNAL_SERVER_ERROR,
                );
            }

            const paymentMetadata = (payment.metadata as Record<string, unknown> | null) ?? {};
            const holdIds = Array.isArray(paymentMetadata.hold_ids)
                ? (paymentMetadata.hold_ids as unknown[]).map((value) => String(value)).filter((value) => isValidUuid(value))
                : [];
            const holdId = String(paymentMetadata.hold_id ?? dto.hold_id ?? "");
            if (holdId && isValidUuid(holdId) && !holdIds.includes(holdId)) {
                holdIds.push(holdId);
            }
            let expiresAt = new Date();

            if (holdIds.length > 0) {
                const holds = [];
                for (const id of holdIds) {
                    holds.push(await this.loadLockedActiveHold(manager, id, actor.userId));
                }
                expiresAt = holds.reduce(
                    (earliest, hold) => hold.expires_at < earliest ? hold.expires_at : earliest,
                    holds[0].expires_at,
                );
            }

            const checkout = await this.payFastService.createCheckoutSession({
                basketId: bookingEntity.booking_number,
                amount: Number(bookingEntity.total_amount),
                customerEmail: bookingEntity.guest_email,
                customerMobile: bookingEntity.guest_phone,
                customerIp,
                description: `Hotel booking ${bookingEntity.booking_number}`,
                successUrl: this.buildPayFastReturnUrl("success", bookingEntity.id),
                failureUrl: this.buildPayFastReturnUrl("failure", bookingEntity.id),
                checkoutUrl: this.buildPayFastFrontendStatusUrl(bookingEntity.id, "processing"),
            });

            payment.provider = "payfast";
            payment.metadata = this.mergePaymentMetadata(payment, {
                checkout_mode: "payfast_redirect",
                basket_id: bookingEntity.booking_number,
                access_token_issued: true,
                checkout_url: checkout.checkoutUrl,
                customer_ip: customerIp || null,
                expires_at: expiresAt.toISOString(),
            });
            await manager.getRepository(BookingPayment).save(payment);

            await this.auditService.record({
                booking_id: bookingEntity.id,
                event_type: "booking_payment_checkout_initiated",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.CUSTOMER,
                source: BookingSource.CUSTOMER_WEB,
                after_state: {
                    booking_status: bookingEntity.booking_status,
                    payment_status: bookingEntity.payment_status,
                },
                metadata: {
                    provider: "payfast",
                    basket_id: bookingEntity.booking_number,
                    expires_at: expiresAt.toISOString(),
                },
            }, manager);

            return {
                booking_id: bookingEntity.id,
                booking_number: bookingEntity.booking_number,
                checkout_url: checkout.checkoutUrl,
                form_fields: checkout.formFields,
                expires_at: expiresAt,
            };
        });

        return session;
    }

    async resumeCustomerCheckout(
        bookingId: string,
        actor: AuthActor,
        customerIp: string,
    ): Promise<IHotelBookingCheckoutResponseDTO> {
        if (actor.userType !== UserRole.CUSTOMER) {
            throw new AppError("Only customers can resume web booking payments", 403, ErrorCodes.FORBIDDEN);
        }

        return AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(bookingId, actor, "customer", manager);
            const payment = this.getLatestPayFastPayment(booking);

            if (!payment || !this.isDeferredPayFastPayment(payment)) {
                throw new AppError("This booking does not have a resumable PayFast checkout.", 409, ErrorCodes.CONFLICT);
            }

            if (booking.booking_status !== HotelBookingStatus.PENDING || booking.payment_status !== BookingPaymentStatus.PENDING) {
                throw new AppError("Only pending unpaid bookings can be resumed.", 409, ErrorCodes.CONFLICT);
            }

            if (this.isCheckoutExpiredForBooking(booking, payment)) {
                throw new AppError("This payment window has expired. Please start a new booking.", 409, ErrorCodes.CONFLICT);
            }

            const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
            const holdIds = Array.isArray(metadata.hold_ids)
                ? (metadata.hold_ids as unknown[]).map((value) => String(value)).filter((value) => isValidUuid(value))
                : [];
            const holdId = String(metadata.hold_id ?? "");
            if (holdId && isValidUuid(holdId) && !holdIds.includes(holdId)) {
                holdIds.push(holdId);
            }

            if (holdIds.length === 0) {
                throw new AppError("This booking is missing its room hold and cannot be resumed.", 409, ErrorCodes.CONFLICT);
            }

            const holds = [];
            for (const id of holdIds) {
                holds.push(await this.loadLockedActiveHold(manager, id, actor.userId));
            }
            const expiresAt = holds.reduce(
                (earliest, hold) => hold.expires_at < earliest ? hold.expires_at : earliest,
                holds[0].expires_at,
            );

            const checkout = await this.payFastService.createCheckoutSession({
                basketId: booking.booking_number,
                amount: Number(booking.total_amount),
                customerEmail: booking.guest_email,
                customerMobile: booking.guest_phone,
                customerIp,
                description: `Hotel booking ${booking.booking_number}`,
                successUrl: this.buildPayFastReturnUrl("success", booking.id),
                failureUrl: this.buildPayFastReturnUrl("failure", booking.id),
                checkoutUrl: this.buildPayFastFrontendStatusUrl(booking.id, "processing"),
            });

            payment.provider = "payfast";
            payment.metadata = this.mergePaymentMetadata(payment, {
                checkout_mode: "payfast_redirect",
                basket_id: booking.booking_number,
                access_token_issued: true,
                checkout_url: checkout.checkoutUrl,
                customer_ip: customerIp || null,
                expires_at: expiresAt.toISOString(),
            });
            await manager.getRepository(BookingPayment).save(payment);

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_payment_checkout_resumed",
                actor_user_id: actor.userId,
                actor_role: BookingAuditActorRole.CUSTOMER,
                source: BookingSource.CUSTOMER_WEB,
                after_state: {
                    booking_status: booking.booking_status,
                    payment_status: booking.payment_status,
                },
                metadata: {
                    provider: "payfast",
                    basket_id: booking.booking_number,
                    expires_at: expiresAt.toISOString(),
                },
            }, manager);

            return {
                booking_id: booking.id,
                booking_number: booking.booking_number,
                checkout_url: checkout.checkoutUrl,
                form_fields: checkout.formFields,
                expires_at: expiresAt,
            };
        });
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
        const {
            booking,
            refundRequested,
        } = await AppDataSource.transaction(async (manager) => {
            const booking = await this.loadBookingForActor(bookingId, actor, "customer", manager);

            if (![HotelBookingStatus.PENDING, HotelBookingStatus.CONFIRMED].includes(booking.booking_status)) {
                throw new AppError(
                    "Only pending or confirmed bookings can request cancellation",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            const previousBookingStatus = booking.booking_status;
            const previousStatus = booking.cancellation_status;
            const previousRefundStatus = booking.refund_status;
            let refundEligible: boolean | null = null;
            let refundMessage: string | null = null;
            let refundAmount: number | null = null;

            booking.booking_status = HotelBookingStatus.CANCELLED;
            booking.cancellation_status = BookingCancellationStatus.CANCELLED;
            booking.cancelled_by_user_id = actor.userId;
            booking.cancelled_at = new Date();
            await this.releaseCheckoutHoldIfPresent(manager, booking);

            let refundRequested = false;

            const hasPaidBalance = [
                BookingPaymentStatus.PAID,
                BookingPaymentStatus.PARTIALLY_PAID,
                BookingPaymentStatus.PARTIALLY_REFUNDED,
                BookingPaymentStatus.REFUNDED,
            ].includes(booking.payment_status);

            if (hasPaidBalance) {
                const existingRequestedRefund = (booking.refunds ?? []).find((refund) =>
                    [
                        BookingRefundStatus.REQUESTED,
                        BookingRefundStatus.APPROVED,
                        BookingRefundStatus.PROCESSING,
                    ].includes(refund.status),
                );

                if (existingRequestedRefund) {
                    refundRequested = true;
                    refundEligible = null;
                    refundAmount = Number(existingRequestedRefund.amount);
                    refundMessage = "Your booking was cancelled. A refund request for this booking is already in progress.";
                } else {
                    const refundablePayment = (booking.payments ?? []).find((payment) =>
                        Number(payment.captured_amount) - Number(payment.refunded_amount) > 0,
                    );

                    if (refundablePayment) {
                        const eligibility = await this.getRefundEligibility(manager, booking);
                        const refundableAmount = Number(refundablePayment.captured_amount) - Number(refundablePayment.refunded_amount);
                        const trimmedReason = reason?.trim();
                        const refund = manager.getRepository(BookingRefund).create({
                            booking_id: booking.id,
                            booking,
                            payment_id: refundablePayment.id,
                            payment: refundablePayment,
                            refund_type: BookingRefundType.FULL,
                            amount: Number(refundableAmount.toFixed(2)),
                            reason: trimmedReason || "Refund requested after customer cancellation",
                            requested_by_user_id: actor.userId,
                            status: BookingRefundStatus.REQUESTED,
                            metadata: {
                                auto_requested_on_cancellation: true,
                                policy_eligible: eligibility.eligible,
                                policy_reason: eligibility.message,
                                refund_cutoff_hours_snapshot: eligibility.refundCutoffHours,
                                cancellation_policy_snapshot: eligibility.cancellationPolicy,
                                policy_source: eligibility.source,
                            },
                        });
                        const savedRefund = await manager.getRepository(BookingRefund).save(refund);

                        booking.refund_status = BookingRefundStatus.REQUESTED;
                        refundRequested = true;
                        refundEligible = eligibility.eligible;
                        refundMessage = eligibility.eligible
                            ? "Your booking was cancelled and a refund request was created."
                            : eligibility.message || "Your booking was cancelled, but this refund request is not eligible under the booking policy.";
                        refundAmount = Number(savedRefund.amount);

                        await this.statusHistoryService.record({
                            booking_id: booking.id,
                            status_type: BookingStatusType.REFUND,
                            from_status: previousRefundStatus,
                            to_status: BookingRefundStatus.REQUESTED,
                            changed_by_user_id: actor.userId,
                            reason: trimmedReason ?? null,
                            metadata: {
                                refund_id: savedRefund.id,
                                payment_id: refundablePayment.id,
                                amount: Number(savedRefund.amount),
                                auto_requested_on_cancellation: true,
                                policy_eligible: eligibility.eligible,
                            },
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
                                payment_id: refundablePayment.id,
                                amount: Number(savedRefund.amount),
                                reason: savedRefund.reason ?? null,
                                auto_requested_on_cancellation: true,
                                policy_eligible: eligibility.eligible,
                                policy_reason: eligibility.message,
                            },
                        }, manager);
                    } else {
                        refundRequested = false;
                        refundEligible = null;
                        refundMessage = "Your booking was cancelled. No refundable payment was found for this booking.";
                    }
                }
            } else {
                refundRequested = false;
                refundEligible = null;
                refundMessage = "Your booking was cancelled. No refundable payment was found for this booking.";
            }

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
                event_type: "booking_cancelled_by_customer",
                actor_user_id: actor.userId,
                source: "customer",
                before_state: {
                    booking_status: previousBookingStatus,
                    cancellation_status: previousStatus,
                },
                after_state: {
                    booking_status: HotelBookingStatus.CANCELLED,
                    cancellation_status: BookingCancellationStatus.CANCELLED,
                    refund_status: booking.refund_status,
                },
                metadata: reason ? { reason } : null,
            }, manager);

            await this.publishBookingEvent(
                booking as HotelBooking & { listing: Listing },
                "booking_cancelled_by_customer",
                manager,
            );

            if (refundRequested) {
                await this.publishBookingEvent(
                    booking as HotelBooking & { listing: Listing },
                    "booking_refund_requested",
                    manager,
                );
            }

            return {
                booking: {
                    ...(await this.getBookingById(booking.id, actor, "customer", manager)),
                    cancellation_refund: {
                        refund_requested: refundRequested,
                        refund_eligible: refundEligible,
                        refund_message: refundMessage,
                        refund_amount: refundAmount,
                    },
                },
                refundRequested,
                refundEligible,
                refundMessage,
                refundAmount,
            };
        });
        if (booking.payment_status === BookingPaymentStatus.PAID) {
            await this.notifyBookingLifecycle(booking.id, "cancelled", reason ?? null);
        }
        if (refundRequested && booking.payment_status === BookingPaymentStatus.PAID) {
            await this.notifyBookingLifecycle(booking.id, "refund_requested", reason ?? null);
        }
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

        let shouldNotifyLifecycle = false;
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
                booking,
                payment_id: payment.id,
                payment,
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
                await this.releaseCheckoutHoldIfPresent(manager, booking);
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

            shouldNotifyLifecycle = booking.payment_status === BookingPaymentStatus.PAID;

            return this.getRefundById(savedRefund.id, actor, "customer", manager);
        });
        if (shouldNotifyLifecycle) {
            await this.notifyBookingLifecycle(input.booking_id, "refund_requested", input.reason ?? null);
        }
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
            metadata: refund.metadata ?? null,
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

    private async finalizeGatewayPaidBooking(
        manager: EntityManager,
        booking: HotelBooking,
        payment: BookingPayment,
        transactionId?: string | null,
    ): Promise<void> {
        if (booking.payment_status === BookingPaymentStatus.PAID && booking.booking_status === HotelBookingStatus.CONFIRMED) {
            return;
        }

        const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
        const holdIds = Array.isArray(metadata.hold_ids)
            ? (metadata.hold_ids as unknown[]).map((value) => String(value)).filter((value) => isValidUuid(value))
            : [];
        const holdId = String(metadata.hold_id ?? "");
        if (holdId && isValidUuid(holdId) && !holdIds.includes(holdId)) {
            holdIds.push(holdId);
        }
        const rawAllocations = Array.isArray(metadata.room_allocations)
            ? metadata.room_allocations as Array<{ room_type_id?: unknown; rooms_count?: unknown }>
            : [];
        const allocations = rawAllocations.length > 0
            ? rawAllocations
                .map((allocation) => ({
                    room_type_id: String(allocation.room_type_id ?? ""),
                    rooms_count: Number(allocation.rooms_count ?? 0),
                }))
                .filter((allocation) => isValidUuid(allocation.room_type_id) && Number.isInteger(allocation.rooms_count) && allocation.rooms_count > 0)
            : [{ room_type_id: booking.room_type_id, rooms_count: booking.rooms_count }];
        const holds = holdIds.length > 0
            ? await manager.getRepository(BookingRoomHold).find({ where: holdIds.map((id) => ({ id })), relations: ["listing"] })
            : [];
        const holdIdsByRoomTypeId = holds.reduce((map, hold) => {
            map.set(hold.room_type_id, [...(map.get(hold.room_type_id) ?? []), hold.id]);
            return map;
        }, new Map<string, string[]>());

        let inventoryUnavailable = false;
        for (const allocation of allocations) {
            const roomType = await this.loadLockedRoomType(manager, allocation.room_type_id);
            const reservedRooms = await this.getReservedRoomCount(
                manager,
                allocation.room_type_id,
                booking.check_in_date,
                booking.check_out_date,
            );
            const heldRooms = await this.getActiveHoldRoomCount(
                manager,
                allocation.room_type_id,
                booking.check_in_date,
                booking.check_out_date,
                holdIdsByRoomTypeId.get(allocation.room_type_id) ?? [],
            );
            const availableRooms = roomType.total_rooms - reservedRooms - heldRooms;
            if (allocation.rooms_count > availableRooms) {
                inventoryUnavailable = true;
                break;
            }
        }

        if (inventoryUnavailable) {
            const previousPaymentStatus = booking.payment_status;
            booking.payment_status = BookingPaymentStatus.PAID;
            payment.payment_status = BookingPaymentStatus.PAID;
            payment.captured_amount = Number(booking.total_amount);
            payment.transaction_id = transactionId ?? payment.transaction_id ?? null;
            payment.provider_payment_id = transactionId ?? payment.provider_payment_id ?? null;
            payment.metadata = this.mergePaymentMetadata(payment, {
                checkout_status: "verified_success_manual_review",
                verified_at: new Date().toISOString(),
                manual_review_required: true,
                payment_issue: "inventory_unavailable_after_payment",
            });
            await manager.getRepository(BookingPayment).save(payment);
            await manager.getRepository(HotelBooking).save(booking);

            if (previousPaymentStatus !== booking.payment_status) {
                await this.statusHistoryService.record({
                    booking_id: booking.id,
                    status_type: BookingStatusType.PAYMENT,
                    from_status: previousPaymentStatus,
                    to_status: booking.payment_status,
                    changed_by_user_id: booking.customer_user_id ?? booking.created_by_user_id ?? null,
                    metadata: {
                        provider: "payfast",
                        transaction_id: payment.transaction_id ?? null,
                        manual_review_required: true,
                    },
                }, manager);
            }

            await this.auditService.record({
                booking_id: booking.id,
                event_type: "booking_payment_captured_manual_review_required",
                actor_user_id: null,
                actor_role: BookingAuditActorRole.SYSTEM,
                source: "payfast",
                before_state: {
                    booking_status: booking.booking_status,
                    payment_status: previousPaymentStatus,
                },
                after_state: {
                    booking_status: booking.booking_status,
                    payment_status: booking.payment_status,
                },
                metadata: {
                    provider: "payfast",
                    transaction_id: payment.transaction_id ?? null,
                    payment_issue: "inventory_unavailable_after_payment",
                },
            }, manager);

            return;
        }

        const allocationRepo = manager.getRepository(HotelBookingAllocation);
        const existingAllocation = await allocationRepo.findOne({
            where: { booking_id: booking.id },
        });
        if (!existingAllocation) {
            const bookingAllocations = allocations.map((allocation) => allocationRepo.create({
                booking_id: booking.id,
                listing_id: booking.listing_id,
                room_type_id: allocation.room_type_id,
                quantity_reserved: allocation.rooms_count,
            }));
            await allocationRepo.save(bookingAllocations);
        }

        for (const hold of holds) {
            if (hold && hold.status === BookingHoldStatus.ACTIVE) {
                hold.status = BookingHoldStatus.CONSUMED;
                hold.consumed_at = new Date();
                await manager.getRepository(BookingRoomHold).save(hold);
                if (hold.listing) {
                    await this.publishHoldEvent(
                        hold as BookingRoomHold & { listing: Listing },
                        "hold_consumed",
                        manager,
                    );
                }
            }
        }

        const previousBookingStatus = booking.booking_status;
        const previousPaymentStatus = booking.payment_status;
        booking.payment_status = BookingPaymentStatus.PAID;
        payment.payment_status = BookingPaymentStatus.PAID;
        payment.captured_amount = Number(booking.total_amount);
        payment.transaction_id = transactionId ?? payment.transaction_id ?? null;
        payment.provider_payment_id = transactionId ?? payment.provider_payment_id ?? null;
        payment.metadata = this.mergePaymentMetadata(payment, {
            checkout_status: "verified_success",
            verified_at: new Date().toISOString(),
        });
        await manager.getRepository(BookingPayment).save(payment);

        booking.booking_status = await this.shouldAutoConfirmPaidBooking(manager, booking.listing_id)
            ? HotelBookingStatus.CONFIRMED
            : HotelBookingStatus.CONFIRMED;
        booking.confirmed_at = booking.confirmed_at ?? new Date();
        await manager.getRepository(HotelBooking).save(booking);

        await this.statusHistoryService.record({
            booking_id: booking.id,
            status_type: BookingStatusType.PAYMENT,
            from_status: previousPaymentStatus,
            to_status: booking.payment_status,
            changed_by_user_id: booking.customer_user_id ?? booking.created_by_user_id ?? null,
            metadata: {
                provider: "payfast",
                transaction_id: payment.transaction_id ?? null,
            },
        }, manager);

        if (previousBookingStatus !== booking.booking_status) {
            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.BOOKING,
                from_status: previousBookingStatus,
                to_status: booking.booking_status,
                changed_by_user_id: booking.customer_user_id ?? booking.created_by_user_id ?? null,
                metadata: {
                    provider: "payfast",
                    auto_confirm_paid_bookings: true,
                },
            }, manager);
        }

        await this.auditService.record({
            booking_id: booking.id,
            event_type: "booking_payment_verified_by_gateway",
            actor_user_id: null,
            actor_role: BookingAuditActorRole.SYSTEM,
            source: "payfast",
            before_state: {
                booking_status: previousBookingStatus,
                payment_status: previousPaymentStatus,
            },
            after_state: {
                booking_status: booking.booking_status,
                payment_status: booking.payment_status,
            },
            metadata: {
                provider: "payfast",
                transaction_id: payment.transaction_id ?? null,
            },
        }, manager);

        await this.publishBookingEvent(
            booking as HotelBooking & { listing: Listing },
            "booking_payment_verified_by_gateway",
            manager,
        );

    }

    private async markGatewayPaymentFailed(
        manager: EntityManager,
        booking: HotelBooking,
        payment: BookingPayment,
        state: "failed" | "cancelled" | "pending",
        transactionId?: string | null,
        message?: string | null,
    ): Promise<void> {
        const previousPaymentStatus = booking.payment_status;
        payment.payment_status = state === "pending" ? BookingPaymentStatus.PENDING : BookingPaymentStatus.FAILED;
        payment.transaction_id = transactionId ?? payment.transaction_id ?? null;
        payment.provider_payment_id = transactionId ?? payment.provider_payment_id ?? null;
        payment.metadata = this.mergePaymentMetadata(payment, {
            checkout_status: state,
            gateway_message: message ?? null,
            verified_at: new Date().toISOString(),
        });
        await manager.getRepository(BookingPayment).save(payment);

        booking.payment_status = payment.payment_status;
        await manager.getRepository(HotelBooking).save(booking);

        if (previousPaymentStatus !== booking.payment_status) {
            await this.statusHistoryService.record({
                booking_id: booking.id,
                status_type: BookingStatusType.PAYMENT,
                from_status: previousPaymentStatus,
                to_status: booking.payment_status,
                changed_by_user_id: booking.customer_user_id ?? booking.created_by_user_id ?? null,
                metadata: {
                    provider: "payfast",
                    transaction_id: payment.transaction_id ?? null,
                    gateway_state: state,
                },
            }, manager);
        }

        await this.auditService.record({
            booking_id: booking.id,
            event_type: state === "cancelled"
                ? "booking_payment_cancelled_by_gateway"
                : state === "failed"
                    ? "booking_payment_failed_by_gateway"
                    : "booking_payment_pending_gateway_review",
            actor_role: BookingAuditActorRole.SYSTEM,
            source: "payfast",
            before_state: {
                payment_status: previousPaymentStatus,
            },
            after_state: {
                payment_status: booking.payment_status,
            },
            metadata: {
                provider: "payfast",
                transaction_id: payment.transaction_id ?? null,
                gateway_message: message ?? null,
            },
        }, manager);
    }

    private async verifyPayFastBookingInternal(
        bookingId: string,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<HotelBooking> {
        const booking = await this.loadBookingForGateway(bookingId, manager);
        const payment = this.getLatestPayFastPayment(booking);
        if (!payment) {
            return booking;
        }

        const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
        const basketId = String(metadata.basket_id ?? booking.booking_number ?? "");
        const statusResult = await this.payFastService.getTransactionStatus({
            transactionId: payment.transaction_id ?? payment.provider_payment_id ?? null,
            basketId,
        });

        if (statusResult.state === "paid") {
            await this.finalizeGatewayPaidBooking(
                manager,
                booking,
                payment,
                statusResult.transactionId ?? payment.transaction_id ?? null,
            );
        } else {
            await this.markGatewayPaymentFailed(
                manager,
                booking,
                payment,
                statusResult.state,
                statusResult.transactionId ?? payment.transaction_id ?? null,
                statusResult.message,
            );
        }

        return this.loadBookingForGateway(bookingId, manager);
    }

    async verifyCustomerPayFastBooking(bookingId: string, actor: AuthActor): Promise<IHotelBookingDTO> {
        if (actor.userType !== UserRole.CUSTOMER) {
            throw new AppError("Only customers can verify web booking payments", 403, ErrorCodes.FORBIDDEN);
        }

        const ownedBooking = await this.loadBookingForActor(bookingId, actor, "customer");
        const verified = await AppDataSource.transaction((manager) => this.verifyPayFastBookingInternal(ownedBooking.id, manager));
        if (ownedBooking.payment_status !== BookingPaymentStatus.PAID
            && verified.payment_status === BookingPaymentStatus.PAID) {
            await this.notifyBookingLifecycle(verified.id, "confirmed");
        }
        return this.toDTO(verified);
    }

    async handlePayFastReturn(
        bookingId: string,
        result: string,
        payload: Record<string, unknown>,
    ): Promise<string> {
        if (!bookingId || !isValidUuid(bookingId)) {
            return this.buildPayFastFrontendStatusUrl("", "failed");
        }

        try {
            const previousBooking = await this.loadBookingForGateway(bookingId);
            const booking = await AppDataSource.transaction(async (manager) => {
                const booking = await this.loadBookingForGateway(bookingId, manager);
                const payment = this.getLatestPayFastPayment(booking);
                if (!payment) {
                    return booking;
                }

                const transactionId = payload.transaction_id ?? payload.transactionId ?? payload.txn_id ?? null;
                const errCode = payload.err_code ?? payload.errCode ?? payload.code ?? null;
                const basketId = String(
                    payload.basket_id
                    ?? payload.basketId
                    ?? (payment.metadata as Record<string, unknown> | null)?.basket_id
                    ?? booking.booking_number
                    ?? "",
                );
                const validationHash = payload.validation_hash ?? payload.validationHash ?? null;
                const isValidHash = this.payFastService.validateReturnHash({
                    basketId,
                    errCode: errCode ? String(errCode) : null,
                    validationHash: validationHash ? String(validationHash) : null,
                });

                logInfo("PayFast return callback received", {
                    bookingId: booking.id,
                    result,
                    basketId,
                    errCode: errCode ? String(errCode) : null,
                    transactionId: transactionId ? String(transactionId) : null,
                    validationHashPresent: Boolean(validationHash),
                    callbackHashValid: isValidHash,
                });

                payment.transaction_id = transactionId ? String(transactionId) : payment.transaction_id ?? null;
                payment.provider_payment_id = transactionId ? String(transactionId) : payment.provider_payment_id ?? null;
                payment.metadata = this.mergePaymentMetadata(payment, {
                    return_result: result,
                    basket_id: basketId || null,
                    callback_hash_valid: isValidHash,
                    callback_payload: payload,
                });
                await manager.getRepository(BookingPayment).save(payment);

                if (!isValidHash) {
                    logWarn("PayFast return callback hash validation failed", {
                        bookingId: booking.id,
                        result,
                        basketId,
                        errCode: errCode ? String(errCode) : null,
                    });

                    await this.auditService.record({
                        booking_id: booking.id,
                        event_type: "booking_payment_callback_hash_invalid",
                        actor_role: BookingAuditActorRole.SYSTEM,
                        source: BookingSource.CUSTOMER_WEB,
                        after_state: {
                            booking_status: booking.booking_status,
                            payment_status: booking.payment_status,
                        },
                        metadata: {
                            provider: "payfast",
                            basket_id: basketId,
                            err_code: errCode ?? null,
                        },
                    }, manager);

                    return booking;
                }

                return this.verifyPayFastBookingInternal(bookingId, manager);
            });

            if (previousBooking.payment_status !== BookingPaymentStatus.PAID
                && booking.payment_status === BookingPaymentStatus.PAID) {
                await this.notifyBookingLifecycle(booking.id, "confirmed");
            }
            const status = booking.payment_status === BookingPaymentStatus.PAID
                ? "success"
                : booking.payment_status === BookingPaymentStatus.FAILED
                    ? "failed"
                    : "pending";
            return this.buildPayFastFrontendStatusUrl(booking.id, status);
        } catch {
            return this.buildPayFastFrontendStatusUrl(bookingId, result === "success" ? "pending" : "failed");
        }
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

    async expireExpiredPayments(): Promise<number> {
        return this.expireStalePendingPayments();
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
