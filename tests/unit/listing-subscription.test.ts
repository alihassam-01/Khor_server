import { test } from "node:test";
import assert from "node:assert/strict";

import { ListingSubscriptionService } from "@modules/user/service/listing/listing-subscription.service";
import { SubscriptionType } from "@common/enums/subscription.enums";
import { SUBSCRIPTION_DURATION_DAYS } from "@common/constants";

test("daysFor returns the configured duration for known subscription types", () => {
    const svc = new ListingSubscriptionService();
    assert.equal(svc.daysFor(SubscriptionType.MONTHLY), SUBSCRIPTION_DURATION_DAYS.MONTHLY);
    assert.equal(svc.daysFor(SubscriptionType.FREE), SUBSCRIPTION_DURATION_DAYS.FREE);
});

test("daysFor falls back to 30 for unknown values", () => {
    const svc = new ListingSubscriptionService();
    assert.equal(svc.daysFor("nonsense" as SubscriptionType), 30);
    assert.equal(svc.daysFor(undefined), 30);
    assert.equal(svc.daysFor(null), 30);
});
