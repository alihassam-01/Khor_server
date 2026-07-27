import { EntityManager } from "typeorm";
import { CONFIG } from "@config/config";
import {
    NotificationChannel,
    NotificationOutboxStatus,
} from "@common/enums/notification.enums";
import { BookingPaymentStatus, BookingSource } from "@common/enums/booking.enums";
import { normalizePhoneToE164 } from "@common/utils/phone.util";
import { HotelBooking } from "@modules/user/entity/booking";
import { NotificationOutbox, BusinessProfile } from "@modules/user/entity/user";

type LifecycleConfig = {
    eventType: string;
    label: string;
    customerMessage: string;
    ownerMessage: string;
    repeatable?: boolean;
};

const LIFECYCLE_EVENTS: Record<string, LifecycleConfig> = {
    booking_created: {
        eventType: "booking.created",
        label: "booking received",
        customerMessage: "We received your booking and shared it with the hotel owner.",
        ownerMessage: "A new booking has been placed through Khor.",
    },
    booking_confirmed_by_vendor: {
        eventType: "booking.confirmed",
        label: "booking confirmed",
        customerMessage: "The hotel owner confirmed your booking.",
        ownerMessage: "This booking is confirmed in Khor.",
    },
    booking_cancelled_by_vendor: {
        eventType: "booking.cancelled",
        label: "booking cancelled",
        customerMessage: "The hotel cancelled this booking.",
        ownerMessage: "This booking has been cancelled.",
    },
    booking_cancelled_by_customer: {
        eventType: "booking.cancelled",
        label: "booking cancelled",
        customerMessage: "Your booking has been cancelled.",
        ownerMessage: "The customer cancelled this booking.",
    },
    booking_cancelled_by_admin: {
        eventType: "booking.cancelled",
        label: "booking cancelled",
        customerMessage: "Khor support cancelled this booking.",
        ownerMessage: "Khor support cancelled this booking.",
    },
    booking_cancellation_requested: {
        eventType: "booking.cancellation_requested",
        label: "cancellation requested",
        customerMessage: "Your cancellation request was received and is awaiting review.",
        ownerMessage: "The customer requested cancellation for this booking.",
    },
    booking_payment_recorded_by_vendor: {
        eventType: "booking.payment_recorded",
        label: "payment updated",
        customerMessage: "A payment update was recorded for your booking.",
        ownerMessage: "A payment update was recorded for this booking.",
        repeatable: true,
    },
    booking_payment_verified_by_gateway: {
        eventType: "booking.payment_verified",
        label: "payment confirmed",
        customerMessage: "Your payment was verified and your booking is confirmed.",
        ownerMessage: "Payment was verified and this booking is confirmed.",
    },
    booking_refund_requested: {
        eventType: "booking.refund_requested",
        label: "refund requested",
        customerMessage: "Your refund request was received.",
        ownerMessage: "The customer requested a refund for this booking.",
    },
};

export class NotificationOutboxService {
    async enqueueBookingLifecycle(
        manager: EntityManager,
        bookingId: string,
        action: string,
    ): Promise<void> {
        if (!CONFIG.notifications.whatsappEnabled
            || !CONFIG.notifications.whatsappBookingLifecycleEnabled) {
            return;
        }

        const event = LIFECYCLE_EVENTS[action];
        if (!event) return;

        const booking = await manager.getRepository(HotelBooking)
            .createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.contact", "contact")
            .leftJoinAndSelect("listing.vendor", "vendor")
            .leftJoinAndSelect("vendor.profile", "vendor_profile")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .leftJoinAndSelect("booking.payments", "payments")
            .where("booking.id = :bookingId", { bookingId })
            .getOne();
        if (!booking) return;

        if (
            booking.source === BookingSource.CUSTOMER_WEB
            && booking.payment_status !== BookingPaymentStatus.PAID
        ) {
            return;
        }

        const effectiveEvent = action === "booking_created"
            && booking.booking_status === "confirmed"
            ? {
                ...event,
                eventType: "booking.confirmed",
                label: "booking confirmed",
                customerMessage: "Your payment was recorded and your booking is confirmed.",
                ownerMessage: "A new confirmed booking has been placed through Khor.",
            }
            : event;

        const amountPaid = booking.payments?.reduce((sum, payment) => {
            const status = payment.payment_status;
            if (status === BookingPaymentStatus.FAILED || status === BookingPaymentStatus.EXPIRED) {
                return sum;
            }

            const capturedAmount = Number(payment.captured_amount ?? 0);
            if (capturedAmount > 0) {
                return sum + capturedAmount;
            }

            if (
                status === BookingPaymentStatus.PAID
                || status === BookingPaymentStatus.PARTIALLY_PAID
                || status === BookingPaymentStatus.PARTIALLY_REFUNDED
                || status === BookingPaymentStatus.REFUNDED
                || status === BookingPaymentStatus.AUTHORIZED
            ) {
                return sum + Number(payment.amount ?? 0);
            }

            return sum;
        }, 0) ?? 0;

        const occurrence = effectiveEvent.repeatable
            ? `:${booking.updated_at.toISOString()}`
            : "";
        const basePayload = {
            bookingNumber: booking.booking_number,
            hotelName: booking.listing.name,
            roomName: booking.room_type?.name ?? "Room",
            checkInDate: booking.check_in_date,
            checkOutDate: booking.check_out_date,
            guestCount: booking.guest_count,
            amountPaid,
            totalAmount: Number(booking.total_amount),
            currency: booking.currency,
            hotelPhone: booking.listing.contact?.phone ?? null,
            hotelWhatsApp: booking.listing.contact?.whatsapp ?? null,
            eventLabel: effectiveEvent.label,
        };

        const rows: Array<Partial<NotificationOutbox>> = [];
        const customerPhone = normalizePhoneToE164(booking.guest_phone);
        if (customerPhone) {
            rows.push({
                event_key: `booking:${booking.id}:${effectiveEvent.eventType}:customer${occurrence}:whatsapp`,
                channel: NotificationChannel.WHATSAPP,
                event_type: effectiveEvent.eventType,
                recipient_type: "customer",
                recipient_user_id: booking.customer_user_id ?? null,
                booking_id: booking.id,
                listing_id: booking.listing_id,
                destination: customerPhone,
                template_key: "booking_lifecycle_v1",
                payload: {
                    ...basePayload,
                    recipientName: booking.guest_name,
                    eventMessage: effectiveEvent.customerMessage,
                },
                status: NotificationOutboxStatus.PENDING,
                attempt_count: 0,
                next_attempt_at: new Date(),
            });
        }

        let vendorWhatsapp: string | null = null;
        if (booking.listing.vendor_id) {
            const bpRepo = manager.getRepository(BusinessProfile);
            const bp = await bpRepo.findOne({ where: { user_id: booking.listing.vendor_id } });
            if (bp && bp.whatsapp_number) {
                vendorWhatsapp = bp.whatsapp_number;
            }
        }

        const ownerPhone = normalizePhoneToE164(
            vendorWhatsapp
            ?? booking.listing.vendor?.profile?.phone_number
            ?? booking.listing.contact?.whatsapp
            ?? booking.listing.contact?.phone,
        );
        if (ownerPhone && booking.listing.vendor_id) {
            rows.push({
                event_key: `booking:${booking.id}:${effectiveEvent.eventType}:owner${occurrence}:whatsapp`,
                channel: NotificationChannel.WHATSAPP,
                event_type: effectiveEvent.eventType,
                recipient_type: "owner",
                recipient_user_id: booking.listing.vendor_id,
                booking_id: booking.id,
                listing_id: booking.listing_id,
                destination: ownerPhone,
                template_key: "booking_lifecycle_v1",
                payload: {
                    ...basePayload,
                    recipientName: booking.listing.vendor?.profile?.business_name
                        ?? booking.listing.vendor?.profile?.username
                        ?? "Hotel owner",
                    eventMessage: effectiveEvent.ownerMessage,
                },
                status: NotificationOutboxStatus.PENDING,
                attempt_count: 0,
                next_attempt_at: new Date(),
            });
        }

        if (rows.length === 0) return;
        await manager.createQueryBuilder()
            .insert()
            .into(NotificationOutbox)
            .values(rows)
            .orIgnore()
            .execute();
    }

    async enqueueOwnerCheckInDigest(input: {
        manager: EntityManager;
        ownerId: string;
        ownerPhone: string | null | undefined;
        ownerName: string;
        localDate: string;
        dateLabel: string;
        items: Array<{
            bookingNumber: string;
            hotelName: string;
            roomName: string;
            guestName: string;
            guestPhone: string;
            guestCount: number;
            roomsCount: number;
        }>;
    }): Promise<void> {
        if (!CONFIG.notifications.whatsappEnabled
            || !CONFIG.notifications.whatsappOwnerCheckInDigestEnabled) {
            return;
        }
        const destination = normalizePhoneToE164(input.ownerPhone);
        if (!destination || input.items.length === 0) return;

        await input.manager.createQueryBuilder()
            .insert()
            .into(NotificationOutbox)
            .values({
                event_key: `owner-checkins:${input.ownerId}:${input.localDate}:whatsapp`,
                channel: NotificationChannel.WHATSAPP,
                event_type: "owner.today_checkins",
                recipient_type: "owner",
                recipient_user_id: input.ownerId,
                destination,
                template_key: "owner_daily_checkins_v1",
                payload: {
                    dateLabel: input.dateLabel,
                    ownerName: input.ownerName,
                    items: input.items,
                },
                status: NotificationOutboxStatus.PENDING,
                attempt_count: 0,
                next_attempt_at: new Date(),
            })
            .orIgnore()
            .execute();
    }

    async enqueuePartnerApproval(input: {
        manager: EntityManager;
        userId: string;
        phoneNumber: string | null | undefined;
        ownerName: string;
        businessName: string;
        approvedCapabilities: string[];
        partnerPortalUrl: string;
    }): Promise<void> {
        if (!CONFIG.notifications.whatsappEnabled) {
            return;
        }

        const destination = normalizePhoneToE164(input.phoneNumber);
        if (!destination) return;

        await input.manager.createQueryBuilder()
            .insert()
            .into(NotificationOutbox)
            .values({
                event_key: `partner-approval:${input.userId}:whatsapp`,
                channel: NotificationChannel.WHATSAPP,
                event_type: "partner.approved",
                recipient_type: "owner",
                recipient_user_id: input.userId,
                destination,
                template_key: "partner_approval_v1",
                payload: {
                    ownerName: input.ownerName,
                    businessName: input.businessName,
                    approvedCapabilities: input.approvedCapabilities,
                    partnerPortalUrl: input.partnerPortalUrl,
                },
                status: NotificationOutboxStatus.PENDING,
                attempt_count: 0,
                next_attempt_at: new Date(),
            })
            .orIgnore()
            .execute();
    }

    async enqueueSubscriptionPaymentReminder(input: {
        manager: EntityManager;
        userId: string;
        listingId: string;
        phoneNumber: string | null | undefined;
        ownerName: string;
        businessName: string;
        dueMonth: string;
        dueDate: string;
        dueKey: string;
    }): Promise<void> {
        if (!CONFIG.notifications.whatsappEnabled) {
            return;
        }

        const destination = normalizePhoneToE164(input.phoneNumber);
        if (!destination) return;

        await input.manager.createQueryBuilder()
            .insert()
            .into(NotificationOutbox)
            .values({
                event_key: `subscription-reminder:${input.listingId}:${input.dueKey}:whatsapp`,
                channel: NotificationChannel.WHATSAPP,
                event_type: "subscription.payment_reminder",
                recipient_type: "owner",
                recipient_user_id: input.userId,
                listing_id: input.listingId,
                destination,
                template_key: "subscription_payment_reminder_v1",
                payload: {
                    ownerName: input.ownerName,
                    businessName: input.businessName,
                    dueMonth: input.dueMonth,
                    dueDate: input.dueDate,
                },
                status: NotificationOutboxStatus.PENDING,
                attempt_count: 0,
                next_attempt_at: new Date(),
            })
            .orIgnore()
            .execute();
    }
}

