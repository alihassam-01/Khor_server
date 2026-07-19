import { renderKhorEmailShell } from "./_theme";

export type BookingLinkedNoticeTemplateInput = {
    guestName: string;
    hotelName: string;
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    loginUrl: string;
    detachUrl: string;
};

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00.000Z`));
}

export function bookingLinkedNoticeTemplate(input: BookingLinkedNoticeTemplateInput): string {
    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Booking:</strong> ${input.bookingNumber}</p>
            <p class="detail-row"><strong>Hotel:</strong> ${input.hotelName}</p>
            <p class="detail-row"><strong>Check-in:</strong> ${formatDate(input.checkInDate)}</p>
            <p class="detail-row"><strong>Check-out:</strong> ${formatDate(input.checkOutDate)}</p>
            <p class="detail-row"><strong>Total:</strong> PKR ${Number(input.totalAmount).toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
            <a href="${input.loginUrl}" style="display: inline-block; padding: 14px 32px; background-color: #008080; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">View Booking Details</a>
        </div>
        <hr style="border: none; border-top: 1px solid #E7EEEE; margin: 30px 0 20px;" />
        <p style="font-size: 14px; color: #667085; text-align: center;">Not your booking? <a href="${input.detachUrl}" style="color: #008080; text-decoration: underline;">Click here to detach it</a> from your account.</p>
    `;

    return renderKhorEmailShell({
        title: `A booking at ${input.hotelName} has been linked to your account`,
        heading: "Booking added to your account",
        greeting: `Hi ${input.guestName},`,
        intro: `A new booking made for you at <strong>${input.hotelName}</strong> has been successfully linked to your Khor account.`,
        content,
    });
}
