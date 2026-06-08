import assert from "node:assert/strict";
import test from "node:test";
import { renderWhatsAppMessage } from "@modules/user/service/whatsapp-message.service";

test("renders booking lifecycle messages without multiline user input", () => {
    const message = renderWhatsAppMessage("booking_lifecycle_v1", {
        bookingNumber: "KHB-123",
        hotelName: "Hotel\nName",
        roomName: "Deluxe",
        checkInDate: "2026-06-12",
        checkOutDate: "2026-06-14",
        guestCount: 2,
        totalAmount: 24000,
        currency: "PKR",
        recipientName: "Guest",
        eventLabel: "booking confirmed",
        eventMessage: "The hotel confirmed your booking.",
    });

    assert.match(message, /Khor: booking confirmed/);
    assert.match(message, /Hotel: Hotel Name/);
    assert.match(message, /Total: PKR 24,000/);
});

test("renders grouped owner check-in digest", () => {
    const message = renderWhatsAppMessage("owner_daily_checkins_v1", {
        dateLabel: "Friday, June 12, 2026",
        ownerName: "Owner",
        items: [{
            bookingNumber: "KHB-123",
            hotelName: "Hotel",
            roomName: "Deluxe",
            guestName: "Guest",
            guestPhone: "+923001234567",
            guestCount: 2,
            roomsCount: 1,
        }],
    });

    assert.match(message, /1 arrival/);
    assert.match(message, /KHB-123 \| Guest/);
});
