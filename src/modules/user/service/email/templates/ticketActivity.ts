import { renderKhorEmailShell } from "./_theme";

export type TicketActivityTemplateInput = {
    heading: string;
    recipientName?: string | null;
    intro: string;
    ticketNumber: string;
    ticketSubject: string;
    ticketStatus: string;
    bookingNumber?: string | null;
    hotelName?: string | null;
    actorName?: string | null;
};

export function ticketActivityTemplate(input: TicketActivityTemplateInput): string {
    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Ticket:</strong> ${input.ticketNumber}</p>
            <p class="detail-row"><strong>Subject:</strong> ${input.ticketSubject}</p>
            <p class="detail-row"><strong>Status:</strong> ${input.ticketStatus}</p>
            ${input.actorName ? `<p class="detail-row"><strong>Updated by:</strong> ${input.actorName}</p>` : ""}
            ${input.bookingNumber ? `<p class="detail-row"><strong>Booking:</strong> ${input.bookingNumber}</p>` : ""}
            ${input.hotelName ? `<p class="detail-row"><strong>Hotel:</strong> ${input.hotelName}</p>` : ""}
        </div>
    `;

    return renderKhorEmailShell({
        title: input.heading,
        heading: input.heading,
        greeting: `Hi ${input.recipientName || "there"},`,
        intro: input.intro,
        content,
        outro: "You can review the full conversation in your Khor account.",
    });
}
