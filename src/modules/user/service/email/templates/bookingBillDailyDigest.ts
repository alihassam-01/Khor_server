import { renderKhorEmailShell } from "./_theme";

export type BookingBillDailyDigestItem = {
    itemName: string;
    amount: number;
};

export type BookingBillDailyDigestTemplateInput = {
    customerName: string;
    hotelName: string;
    bookingNumber: string;
    dateLabel: string;
    currency: string;
    items: BookingBillDailyDigestItem[];
    totalAmount: number;
};

export function bookingBillDailyDigestTemplate(input: BookingBillDailyDigestTemplateInput): string {
    const rows = input.items.map((item, index) => `
        <tr>
            <td>${index + 1}.</td>
            <td>${item.itemName}</td>
            <td>${input.currency} ${Number(item.amount).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join("");

    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Hotel:</strong> ${input.hotelName}</p>
            <p class="detail-row"><strong>Booking:</strong> ${input.bookingNumber}</p>
            <p class="detail-row"><strong>Date:</strong> ${input.dateLabel}</p>
        </div>
        <div class="panel">
            <p class="detail-row"><strong>Your bill today:</strong></p>
            <table class="table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Item</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            <p class="detail-row" style="margin-top: 12px;"><strong>Total:</strong> ${input.currency} ${Number(input.totalAmount).toLocaleString("en-PK", { maximumFractionDigits: 2 })}</p>
        </div>
    `;

    return renderKhorEmailShell({
        title: `Your bill today - ${input.dateLabel}`,
        heading: "Your bill today",
        greeting: `Hi ${input.customerName},`,
        intro: "Here is the summary of the extra items added to your stay today.",
        content,
        outro: "You can contact the hotel directly if you need any clarification about the listed items.",
    });
}
