import { FastifyReply, FastifyRequest } from "fastify";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { 
    IPresignedUrlRequestDTO, 
    IBatchPresignedUrlRequestDTO 
} from "@modules/user/dtos";
import { ICompletePresignedUploadsDTO } from "@modules/user/dtos/r2-presigned.dto";
import { CONFIG } from "@config/config";
import {
  buildUserUploadFolder,
  buildUserUploadRoot,
  MAX_PRESIGNED_UPLOAD_BATCH,
  UploadPolicyError,
  validateImageUpload,
} from "@common/utils/upload-policy.util";


export class R2ClientController {
  private r2ClientService: R2ClientService;

  constructor() {
    this.r2ClientService = new R2ClientService();
  }

  private getUploadIdentity(req: FastifyRequest): { userId: string; userType?: string } {
    const user = (req.user ?? {}) as { id?: string; userId?: string; userType?: string };
    const userId = user.id || user.userId;
    if (!userId) {
      throw new UploadPolicyError("Invalid authenticated user.");
    }
    return { userId, userType: user.userType };
  }

  private sendUploadError(reply: FastifyReply, error: unknown, fallback: string) {
    const err = error as Error;
    if (err instanceof UploadPolicyError) {
      return reply.status(400).send({ error: err.message });
    }
    console.error(fallback, err);
    return reply.status(500).send({ error: fallback });
  }

  /**
   * Upload file through backend
   */
  async uploadFile(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = req.body as any;
      const imagesRaw = body?.images || body?.file || body?.files;
      
      if (!imagesRaw) {
        return reply.status(400).send({ error: "No files provided" });
      }

      const files = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
      if (files.length > MAX_PRESIGNED_UPLOAD_BATCH) {
        return reply.status(400).send({ error: `A maximum of ${MAX_PRESIGNED_UPLOAD_BATCH} files is allowed.` });
      }
      const identity = this.getUploadIdentity(req);
      const uploadFolder = buildUserUploadFolder(identity.userType, identity.userId);
      const uploadResults = [];

      for (const file of files) {
        if (file && typeof file.toBuffer === 'function') {
          const buffer = await file.toBuffer();
          const result = await this.r2ClientService.uploadFileToR2(
            buffer,
            file.filename || 'upload',
            file.mimetype || 'application/octet-stream',
            uploadFolder,
          );
          uploadResults.push(result);
        }
      }

      if (uploadResults.length === 0) {
        return reply.status(400).send({ error: "No valid files were uploaded." });
      }

      reply.send({ status: "success", data: uploadResults });
    } catch (error: unknown) {
      return this.sendUploadError(reply, error, "Upload failed.");
    }
  }

  /**
   * Generate a single presigned URL for direct R2 upload
   */
  async getPresignedUrl(
    req: FastifyRequest<{ Body: IPresignedUrlRequestDTO }>, 
    reply: FastifyReply
  ) {
    try {
      const { fileName, mimeType, fileSize, folder } = req.body;

      if (!fileName || !mimeType) {
        return reply.status(400).send({ error: "fileName and mimeType are required" });
      }

      const maxFileSize = this.r2ClientService.getMaxFileSize();
      const policy = validateImageUpload(fileName, mimeType, fileSize, maxFileSize);
      const identity = this.getUploadIdentity(req);
      const uploadFolder = buildUserUploadFolder(identity.userType, identity.userId, folder);
      const result = await this.r2ClientService.generatePresignedUrl(
        fileName,
        policy.mimeType,
        uploadFolder,
        policy.extension,
        fileSize,
      );

      reply.send({
        status: "success",
        data: { ...result, maxFileSize },
      });
    } catch (error: unknown) {
      return this.sendUploadError(reply, error, "Failed to generate presigned URL.");
    }
  }

  /**
   * Generate multiple presigned URLs for batch direct R2 upload
   */
  async getPresignedUrls(
    req: FastifyRequest<{ Body: IBatchPresignedUrlRequestDTO }>, 
    reply: FastifyReply
  ) {
    try {
      const { files } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return reply.status(400).send({ error: "files array is required and must not be empty" });
      }
      if (files.length > MAX_PRESIGNED_UPLOAD_BATCH) {
        return reply.status(400).send({ error: `A maximum of ${MAX_PRESIGNED_UPLOAD_BATCH} files is allowed.` });
      }

      const maxFileSize = this.r2ClientService.getMaxFileSize();
      const identity = this.getUploadIdentity(req);
      const validatedFiles = files.map((file) => {
        if (!file.fileName || !file.mimeType) {
          throw new UploadPolicyError("Each file must have fileName and mimeType.");
        }
        const policy = validateImageUpload(file.fileName, file.mimeType, file.fileSize, maxFileSize);
        return {
          fileName: file.fileName,
          mimeType: policy.mimeType,
          folder: buildUserUploadFolder(identity.userType, identity.userId, file.folder),
          canonicalExtension: policy.extension,
          contentLength: file.fileSize,
        };
      });
      const results = await this.r2ClientService.generatePresignedUrls(validatedFiles);

      reply.send({
        status: "success",
        data: { urls: results, maxFileSize },
      });
    } catch (error: unknown) {
      return this.sendUploadError(reply, error, "Failed to generate presigned URLs.");
    }
  }

  async completePresignedUploads(
    req: FastifyRequest<{ Body: ICompletePresignedUploadsDTO }>,
    reply: FastifyReply,
  ) {
    try {
      const files = req.body?.files;
      if (!Array.isArray(files) || files.length === 0) {
        throw new UploadPolicyError("files array is required and must not be empty.");
      }
      if (files.length > MAX_PRESIGNED_UPLOAD_BATCH) {
        throw new UploadPolicyError(`A maximum of ${MAX_PRESIGNED_UPLOAD_BATCH} files is allowed.`);
      }

      const identity = this.getUploadIdentity(req);
      const userFolder = buildUserUploadRoot(identity.userType, identity.userId);
      const allowedPrefix = CONFIG.env === "development"
        ? `development/${userFolder}`
        : userFolder;
      const maxFileSize = this.r2ClientService.getMaxFileSize();

      const results = [];
      for (const file of files) {
        const policy = validateImageUpload(
          file.key,
          file.mimeType,
          file.fileSize,
          maxFileSize,
        );
        results.push(await this.r2ClientService.completePresignedUpload(
          file.key,
          file.publicUrl,
          policy.mimeType,
          file.fileSize,
          allowedPrefix,
        ));
      }

      return reply.send({ status: "success", data: { files: results } });
    } catch (error) {
      return this.sendUploadError(reply, error, "Failed to verify uploaded files.");
    }
  }
}
