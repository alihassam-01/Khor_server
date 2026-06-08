type BookingMessagePayload = {
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
    totalAmount: number;
    currency: string;
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
            `Total: ${formatMoney(payload.totalAmount, payload.currency)}`,
            "",
            clean(payload.eventMessage),
        ].join("\n");
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

    throw new Error(`Unsupported WhatsApp template: ${templateKey}`);
}

