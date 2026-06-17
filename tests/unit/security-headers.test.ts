import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import securityPlugin from "@app/plugins/security";
import { CONFIG } from "@config/config";

test("production security plugin sends strict response headers", async () => {
  const originalEnv = CONFIG.env;
  CONFIG.env = "production";
  const app = Fastify();

  try {
    await app.register(securityPlugin);
    app.get("/test", async () => ({ ok: true }));

    const response = await app.inject({ method: "GET", url: "/test" });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    assert.match(String(response.headers["strict-transport-security"]), /max-age=31536000/);
    assert.match(String(response.headers["content-security-policy"]), /default-src 'none'/);
    assert.match(String(response.headers["permissions-policy"]), /camera=\(\)/);
  } finally {
    CONFIG.env = originalEnv;
    await app.close();
  }
});
