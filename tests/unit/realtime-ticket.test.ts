import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@common/enums/user.enums";
import { RealtimeTicketService } from "@modules/user/service/realtime-ticket.service";

test("realtime tickets are single-use and preserve actor identity", () => {
  const service = new RealtimeTicketService(() => 1_000, () => "ticket-one", 60_000);
  const issued = service.issue(
    { userId: "user-1", userType: UserRole.CUSTOMER },
    "booking",
  );

  assert.equal(issued.ticket, "ticket-one");
  assert.deepEqual(
    service.consume(issued.ticket, "booking", UserRole.CUSTOMER),
    { userId: "user-1", userType: UserRole.CUSTOMER },
  );
  assert.equal(service.consume(issued.ticket, "booking", UserRole.CUSTOMER), null);
});

test("realtime tickets reject the wrong scope or role", () => {
  let sequence = 0;
  const service = new RealtimeTicketService(
    () => 1_000,
    () => `ticket-${++sequence}`,
    60_000,
  );

  const wrongScope = service.issue(
    { userId: "vendor-1", userType: UserRole.VENDOR },
    "booking",
  );
  assert.equal(service.consume(wrongScope.ticket, "support", UserRole.VENDOR), null);

  const wrongRole = service.issue(
    { userId: "vendor-1", userType: UserRole.VENDOR },
    "support",
  );
  assert.equal(service.consume(wrongRole.ticket, "support", UserRole.ADMIN), null);
});

test("realtime tickets expire", () => {
  let now = 1_000;
  const service = new RealtimeTicketService(() => now, () => "expired-ticket", 60_000);
  const issued = service.issue(
    { userId: "admin-1", userType: UserRole.ADMIN },
    "support",
  );

  now += 60_001;
  assert.equal(service.consume(issued.ticket, "support", UserRole.ADMIN), null);
});
