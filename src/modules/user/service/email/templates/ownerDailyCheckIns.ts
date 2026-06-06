import { renderKhorEmailShell } from "./_theme";

export type OwnerDailyCheckInItem = {
    bookingNumber: string;
    hotelName: string;
    roomName: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestCount: number;
    roomsCount: number;
    totalAmount: number;
    status: string;
};

export type OwnerDailyCheckInsTemplateInput = {
    ownerName: string;
    dateLabel: string;
    items: OwnerDailyCheckInItem[];
};

export function ownerDailyCheckInsTemplate(input: OwnerDailyCheckInsTemplateInput): string {
    const rows = input.items.map((item) => `
        <tr>
            <td>
                <strong>${item.bookingNumber}</strong><br />
                <span class="muted">${item.hotelName}</span>
            </td>
            <td>${item.roomName}</td>
            <td>
                ${item.guestName}<br />
                <span class="muted">${item.guestEmail}</span><br />
                <span class="muted">${item.guestPhone}</span>
            </td>
            <td>${item.guestCount}</td>
            <td>${item.roomsCount}</td>
            <td>PKR ${Number(item.totalAmount).toLocaleString()}</td>
            <td>${item.status}</td>
        </tr>
    `).join("");

    const content = `
        <div class="panel">
            <p class="detail-row"><strong>${input.items.length}</strong> check-in${input.items.length === 1 ? "" : "s"} scheduled for today.</p>
            <table class="table">
                <thead>
                    <tr>
                        <th>Booking</th>
                        <th>Room</th>
                        <th>Guest</th>
                        <th>Guests</th>
                        <th>Rooms</th>
                        <th>Total</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;

    return renderKhorEmailShell({
        title: `Today's Check-ins - ${input.dateLabel}`,
        heading: "Today's check-ins",
        greeting: `Hi ${input.ownerName},`,
        intro: `Here is your arrival list for ${input.dateLabel}.`,
        content,
        outro: "Please review these arrivals in your Khor dashboard before guests start coming in.",
    });
}
