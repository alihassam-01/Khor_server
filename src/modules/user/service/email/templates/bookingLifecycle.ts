import { renderKhorEmailShell } from "./_theme";

export type BookingLifecycleTemplateInput = {
    heading: string;
    recipientName?: string | null;
    intro: string;
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    guestCount: number;
    reason?: string | null;
    counterpartyName?: string | null;
    counterpartyEmail?: string | null;
};

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00.000Z`));
}

export function bookingLifecycleTemplate(input: BookingLifecycleTemplateInput): string {
    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Booking:</strong> ${input.bookingNumber}</p>
            <p class="detail-row"><strong>Hotel:</strong> ${input.hotelName}</p>
            <p class="detail-row"><strong>Room:</strong> ${input.roomName}</p>
            <p class="detail-row"><strong>Check-in:</strong> ${formatDate(input.checkInDate)}</p>
            <p class="detail-row"><strong>Check-out:</strong> ${formatDate(input.checkOutDate)}</p>
            <p class="detail-row"><strong>Guests:</strong> ${input.guestCount}</p>
            <p class="detail-row"><strong>Total:</strong> PKR ${Number(input.totalAmount).toLocaleString()}</p>
            ${input.counterpartyName ? `<p class="detail-row"><strong>Contact:</strong> ${input.counterpartyName}${input.counterpartyEmail ? ` (${input.counterpartyEmail})` : ""}</p>` : ""}
            ${input.reason ? `<p class="detail-row"><strong>Reason:</strong> ${input.reason}</p>` : ""}
        </div>
    `;

    return renderKhorEmailShell({
        title: input.heading,
        heading: input.heading,
        greeting: `Hi ${input.recipientName || "there"},`,
        intro: input.intro,
        content,
        outro: "You can review the booking details in your Khor account.",
    });
}
