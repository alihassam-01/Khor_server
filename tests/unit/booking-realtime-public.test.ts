import assert from "node:assert/strict";
import test from "node:test";
import { toPublicBookingRealtimeEvent } from "@modules/user/service/booking-realtime.service";

test("public hotel realtime events expose only generic inventory invalidation", () => {
  const publicEvent = toPublicBookingRealtimeEvent({
    type: "booking_changed",
    action: "booking_created",
    listing_id: "listing-secret",
    room_type_id: "room-secret",
    vendor_id: "vendor-secret",
    customer_user_id: "customer-secret",
    booking_source: "customer",
    booking_id: "booking-secret",
    hold_id: "hold-secret",
    occurred_at: "2026-06-15T00:00:00.000Z",
  });

  assert.deepEqual(publicEvent, {
    type: "inventory_changed",
    occurred_at: "2026-06-15T00:00:00.000Z",
  });
  assert.equal("listing_id" in publicEvent, false);
  assert.equal("booking_id" in publicEvent, false);
  assert.equal("customer_user_id" in publicEvent, false);
});
