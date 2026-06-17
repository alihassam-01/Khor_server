import assert from "node:assert/strict";
import test from "node:test";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { RATE_LIMITS } from "../../src/config/rate-limit.config";

test("email abuse endpoints return 429 after the configured threshold", async () => {
    const app = Fastify();
    await app.register(rateLimit, {
        global: true,
        hook: "preHandler",
        max: 300,
        timeWindow: "1 minute",
    });
    app.post(
        "/resend",
        { config: { rateLimit: RATE_LIMITS.otpResend } },
        async (_request, reply) => reply.code(204).send(),
    );

    try {
        for (let attempt = 0; attempt < RATE_LIMITS.otpResend.max; attempt += 1) {
            const response = await app.inject({
                method: "POST",
                url: "/resend",
                payload: { email: "customer@example.com" },
            });
            assert.equal(response.statusCode, 204);
        }

        const limited = await app.inject({
            method: "POST",
            url: "/resend",
            payload: { email: "customer@example.com" },
        });
        assert.equal(limited.statusCode, 429);
        assert.ok(limited.headers["retry-after"]);
    } finally {
        await app.close();
    }
});
