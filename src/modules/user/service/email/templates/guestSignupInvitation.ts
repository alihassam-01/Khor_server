import { renderKhorEmailShell } from "./_theme";

export type GuestSignupInvitationTemplateInput = {
    guestName: string;
    hotelName: string;
    bookingNumber: string;
    checkInDate: string;
    checkOutDate: string;
    totalAmount: number;
    signupUrl: string;
    detachUrl: string;
};

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("en-PK", {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00.000Z`));
}

export function guestSignupInvitationTemplate(input: GuestSignupInvitationTemplateInput): string {
    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Booking:</strong> ${input.bookingNumber}</p>
            <p class="detail-row"><strong>Hotel:</strong> ${input.hotelName}</p>
            <p class="detail-row"><strong>Check-in:</strong> ${formatDate(input.checkInDate)}</p>
            <p class="detail-row"><strong>Check-out:</strong> ${formatDate(input.checkOutDate)}</p>
            <p class="detail-row"><strong>Total:</strong> PKR ${Number(input.totalAmount).toLocaleString()}</p>
        </div>
        <p style="margin: 24px 0 8px;">Create your free Khor account to manage your booking efficiently, view details, and easily contact the hotel.</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="${input.signupUrl}" style="display: inline-block; padding: 14px 32px; background-color: #008080; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Sign Up to Manage Your Booking</a>
        </div>
        <hr style="border: none; border-top: 1px solid #E7EEEE; margin: 30px 0 20px;" />
        <p style="font-size: 14px; color: #667085; text-align: center;">Not your booking? <a href="${input.detachUrl}" style="color: #008080; text-decoration: underline;">Click here to detach your email</a> from this booking.</p>
    `;

    return renderKhorEmailShell({
        title: `You have made a booking at ${input.hotelName}`,
        heading: "You have a new booking waiting for you",
        greeting: `Hi ${input.guestName},`,
        intro: `A new booking has been made for you at <strong>${input.hotelName}</strong>. Sign up on Khor to view and manage it.`,
        content,
    });
}
