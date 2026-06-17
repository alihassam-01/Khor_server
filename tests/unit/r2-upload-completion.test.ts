import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG } from "@config/config";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { UploadPolicyError } from "@common/utils/upload-policy.util";

const createService = (metadata: { ContentLength?: number; ContentType?: string }) => {
  const service = new R2ClientService() as any;
  const saved: any[] = [];
  service.r2Client = {
    send: async () => metadata,
  };
  service.s3Image = {
    findOne: async () => null,
    create: (value: any) => ({ id: "image-1", ...value }),
    save: async (value: any) => {
      saved.push(value);
      return value;
    },
  };
  return { service: service as R2ClientService, saved };
};

test("presigned completion verifies metadata before creating a registry row", async () => {
  const { service, saved } = createService({
    ContentLength: 1234,
    ContentType: "image/webp",
  });
  const key = "user-uploads/vendor/user-1/hotel/demo/image.webp";
  const publicUrl = `${CONFIG.r2.publicUrl.replace(/\/+$/, "")}/${key}`;

  const result = await service.completePresignedUpload(
    key,
    publicUrl,
    "image/webp",
    1234,
    "user-uploads/vendor/user-1",
  );

  assert.equal(result.s3_image_id, "image-1");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].key, key);
});

test("presigned completion rejects wrong ownership or metadata without registering", async () => {
  const { service, saved } = createService({
    ContentLength: 999,
    ContentType: "image/jpeg",
  });
  const key = "user-uploads/vendor/other-user/hotel/demo/image.jpg";
  const publicUrl = `${CONFIG.r2.publicUrl.replace(/\/+$/, "")}/${key}`;

  await assert.rejects(
    service.completePresignedUpload(
      key,
      publicUrl,
      "image/jpeg",
      999,
      "user-uploads/vendor/user-1",
    ),
    UploadPolicyError,
  );
  await assert.rejects(
    service.completePresignedUpload(
      "user-uploads/vendor/user-1/hotel/demo/image.jpg",
      `${CONFIG.r2.publicUrl.replace(/\/+$/, "")}/user-uploads/vendor/user-1/hotel/demo/image.jpg`,
      "image/jpeg",
      1000,
      "user-uploads/vendor/user-1",
    ),
    /metadata does not match/,
  );
  assert.equal(saved.length, 0);
});
