type BookingMessagePayload = {
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    amountPaid?: number;
    totalAmount: number;
    currency: string;
    hotelPhone?: string | null;
    hotelWhatsApp?: string | null;
    recipientName: string;
    eventLabel: string;
    eventMessage: string;
};

type OwnerDigestPayload = {
    dateLabel: string;
    ownerName: string;
    items: Array<{
        bookingNumber: string;
        hotelName: string;
        roomName: string;
        guestName: string;
        guestPhone: string;
        guestCount: number;
        roomsCount: number;
    }>;
};

type BookingBillDailyDigestPayload = {
    recipientName: string;
    bookingNumber: string;
    hotelName: string;
    dateLabel: string;
    currency: string;
    totalAmount: number;
    items: Array<{
        itemName: string;
        amount: number;
    }>;
};

type PartnerApprovalPayload = {
    ownerName: string;
    businessName: string;
    approvedCapabilities: string[];
    partnerPortalUrl: string;
};

type SubscriptionPaymentReminderPayload = {
    ownerName: string;
    businessName: string;
    dueMonth: string;
    dueDate: string;
};

function clean(value: unknown): string {
    return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function formatMoney(amount: number, currency: string): string {
    return `${clean(currency || "PKR")} ${Number(amount).toLocaleString("en-PK", {
        maximumFractionDigits: 2,
    })}`;
}

export function renderWhatsAppMessage(
    templateKey: string,
    rawPayload: Record<string, unknown>,
): string {
    if (templateKey === "booking_lifecycle_v1") {
        const payload = rawPayload as unknown as BookingMessagePayload;
        return [
            `Khor: ${clean(payload.eventLabel)}`,
            "",
            `Booking: ${clean(payload.bookingNumber)}`,
            `Hotel: ${clean(payload.hotelName)}`,
            `Room: ${clean(payload.roomName)}`,
            `Check-in: ${clean(payload.checkInDate)}`,
            `Check-out: ${clean(payload.checkOutDate)}`,
            `Guests: ${Number(payload.guestCount)}`,
            `Amount paid: ${formatMoney(Number(payload.amountPaid ?? 0), payload.currency)}`,
            `Total: ${formatMoney(payload.totalAmount, payload.currency)}`,
            payload.hotelPhone ? `Hotel phone: ${clean(payload.hotelPhone)}` : "",
            payload.hotelWhatsApp ? `Hotel WhatsApp: ${clean(payload.hotelWhatsApp)}` : "",
            "",
            clean(payload.eventMessage),
        ].filter(Boolean).join("\n");
    }

    if (templateKey === "owner_daily_checkins_v1") {
        const payload = rawPayload as unknown as OwnerDigestPayload;
        const items = payload.items.flatMap((item, index) => [
            `${index + 1}. ${clean(item.bookingNumber)} | ${clean(item.guestName)}`,
            `   ${clean(item.hotelName)} | ${clean(item.roomName)} | ${Number(item.roomsCount)} room(s) | ${Number(item.guestCount)} guest(s)`,
            `   Guest phone: ${clean(item.guestPhone)}`,
        ]);
        return [
            `Khor: today's check-ins for ${clean(payload.dateLabel)}`,
            "",
            `${payload.items.length} arrival${payload.items.length === 1 ? "" : "s"}`,
            "",
            ...items,
        ].join("\n");
    }

    if (templateKey === "booking_bill_daily_digest_v1") {
        const payload = rawPayload as unknown as BookingBillDailyDigestPayload;
        const items = payload.items.flatMap((item, index) => [
            `${index + 1}. ${clean(item.itemName)}: ${formatMoney(item.amount, payload.currency)}`,
        ]);
        return [
            `Khor: your bill today`,
            "",
            `Hotel: ${clean(payload.hotelName)}`,
            `Booking: ${clean(payload.bookingNumber)}`,
            `Date: ${clean(payload.dateLabel)}`,
            "",
            `Your Bill today:`,
            ...items,
            "",
            `Total: ${formatMoney(payload.totalAmount, payload.currency)}`,
        ].join("\n");
    }

    if (templateKey === "partner_approval_v1") {
        const payload = rawPayload as unknown as PartnerApprovalPayload;
        const capabilities = payload.approvedCapabilities.length > 0
            ? payload.approvedCapabilities.map((item) => clean(item)).join(", ")
            : "Partner access";
        return [
            "Khor: partner account approved",
            "",
            `Business: ${clean(payload.businessName)}`,
            `Access enabled: ${capabilities}`,
            "",
            `Hi ${clean(payload.ownerName) || "there"}, your partner onboarding is approved.`,
            `Sign in here: ${clean(payload.partnerPortalUrl)}`,
        ].join("\n");
    }

    if (templateKey === "subscription_payment_reminder_v1") {
        const payload = rawPayload as unknown as SubscriptionPaymentReminderPayload;
        return [
            "Khor: Payment Reminder",
            "",
            `Business: ${clean(payload.businessName)}`,
            "",
            `Your due for the month ${clean(payload.dueMonth)} is due by ${clean(payload.dueDate)}.`,
            "Please make sure to make it.",
            "Thank you for being with Khor.",
        ].join("\n");
    }

    throw new Error(`Unsupported WhatsApp template: ${templateKey}`);
}
