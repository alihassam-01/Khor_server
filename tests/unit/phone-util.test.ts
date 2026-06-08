import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhoneToE164 } from "@common/utils/phone.util";

test("normalizes common Pakistani phone formats", () => {
    assert.equal(normalizePhoneToE164("0300 1234567"), "+923001234567");
    assert.equal(normalizePhoneToE164("92-300-1234567"), "+923001234567");
    assert.equal(normalizePhoneToE164("+92 300 1234567"), "+923001234567");
    assert.equal(normalizePhoneToE164("0092 300 1234567"), "+923001234567");
});

test("rejects invalid phone values", () => {
    assert.equal(normalizePhoneToE164("hello"), null);
    assert.equal(normalizePhoneToE164("123"), null);
    assert.equal(normalizePhoneToE164(""), null);
});

