import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUserUploadFolder,
  sanitizeUploadFolder,
  UploadPolicyError,
  validateDocumentUpload,
  validateImageUpload,
} from "@common/utils/upload-policy.util";

const MAX_SIZE = 10 * 1024 * 1024;

test("accepts supported images and assigns canonical extensions", () => {
  assert.deepEqual(
    validateImageUpload("photo.php", "image/jpeg", 1024, MAX_SIZE),
    { mimeType: "image/jpeg", extension: ".jpg" },
  );
  assert.deepEqual(
    validateImageUpload("photo", "image/webp", 1024, MAX_SIZE),
    { mimeType: "image/webp", extension: ".webp" },
  );
});

test("rejects scripts, SVG images, and invalid sizes", () => {
  assert.throws(
    () => validateImageUpload("payload.svg", "image/svg+xml", 1024, MAX_SIZE),
    UploadPolicyError,
  );
  assert.throws(
    () => validateImageUpload("payload.js", "application/javascript", 1024, MAX_SIZE),
    UploadPolicyError,
  );
  assert.throws(
    () => validateImageUpload("photo.jpg", "image/jpeg", MAX_SIZE + 1, MAX_SIZE),
    UploadPolicyError,
  );
});

test("allows PDF business documents but not executable content", () => {
  assert.deepEqual(
    validateDocumentUpload("license.exe", "application/pdf", 2048, MAX_SIZE),
    { mimeType: "application/pdf", extension: ".pdf" },
  );
  assert.throws(
    () => validateDocumentUpload("license.exe", "application/x-msdownload", 2048, MAX_SIZE),
    UploadPolicyError,
  );
});

test("isolates user folders and rejects traversal", () => {
  assert.equal(
    buildUserUploadFolder("vendor", "user_123", "hotel/sample/cover"),
    "user-uploads/vendor/user_123/hotel/sample/cover",
  );
  assert.throws(() => sanitizeUploadFolder("../private"), UploadPolicyError);
  assert.throws(() => sanitizeUploadFolder("hotel//cover"), UploadPolicyError);
  assert.throws(() => sanitizeUploadFolder("https://example.com"), UploadPolicyError);
});
