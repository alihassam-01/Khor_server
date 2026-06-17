import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG, validateProductionConfig } from "@config/config";

test("production configuration rejects weak or shared JWT secrets", () => {
  const original = {
    env: CONFIG.env,
    secret: CONFIG.jwt.secret,
    resetSecret: CONFIG.jwt.resetSecret,
    dbUrl: CONFIG.db.url,
    dbPassword: CONFIG.db.password,
    webDomain: CONFIG.web_domain.url,
    r2: { ...CONFIG.r2 },
  };

  try {
    CONFIG.env = "production";
    CONFIG.jwt.secret = "short";
    CONFIG.jwt.resetSecret = "short";
    CONFIG.db.url = "postgres://configured";
    CONFIG.web_domain.url = "https://example.com";
    CONFIG.r2.accountId = "account";
    CONFIG.r2.accessKeyId = "access";
    CONFIG.r2.secretAccessKey = "secret";
    CONFIG.r2.bucketName = "bucket";
    CONFIG.r2.publicUrl = "https://assets.example.com";

    assert.throws(
      validateProductionConfig,
      /JWT_SECRET must be configured with at least 32 characters/,
    );

    CONFIG.jwt.secret = "a".repeat(32);
    CONFIG.jwt.resetSecret = CONFIG.jwt.secret;
    assert.throws(
      validateProductionConfig,
      /JWT_RESET_SECRET must be different from JWT_SECRET/,
    );
  } finally {
    CONFIG.env = original.env;
    CONFIG.jwt.secret = original.secret;
    CONFIG.jwt.resetSecret = original.resetSecret;
    CONFIG.db.url = original.dbUrl;
    CONFIG.db.password = original.dbPassword;
    CONFIG.web_domain.url = original.webDomain;
    Object.assign(CONFIG.r2, original.r2);
  }
});
