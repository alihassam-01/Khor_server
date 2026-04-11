import { FastifyReply, FastifyRequest } from "fastify";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { 
    IPresignedUrlRequestDTO, 
    IBatchPresignedUrlRequestDTO 
} from "@modules/user/dtos";
import * as fs from "fs";

export class R2ClientController {
  private r2ClientService: R2ClientService;

  constructor() {
    this.r2ClientService = new R2ClientService();
  }

  /**
   * Upload file through backend
   */
  async uploadFile(req: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-ignore - Fastify multipart might not be typed correctly in this context
      const files = (await req.saveRequestFiles?.()) || [];
      if (!files.length) {
        return reply.status(400).send({ error: "No files provided" });
      }

      const uploadResults = [];
      for (const file of files) {
        const buffer = fs.readFileSync(file.filepath);
        const result = await this.r2ClientService.uploadFileToR2(
          buffer,
          file.filename,
          file.mimetype
        );
        uploadResults.push(result);
      }
      reply.send({ status: "success", data: uploadResults });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error uploading files:", err);
      reply.status(500).send({ error: "Upload failed: " + err.message });
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
      const { fileName, mimeType, folder } = req.body;

      if (!fileName || !mimeType) {
        return reply.status(400).send({ error: "fileName and mimeType are required" });
      }

      const maxFileSize = this.r2ClientService.getMaxFileSize();
      const result = await this.r2ClientService.generatePresignedUrl(
        fileName,
        mimeType,
        folder
      );

      reply.send({
        status: "success",
        data: { ...result, maxFileSize },
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error generating presigned URL:", err);
      reply.status(500).send({ error: "Failed to generate presigned URL: " + err.message });
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

      for (const file of files) {
        if (!file.fileName || !file.mimeType) {
          return reply.status(400).send({ error: "Each file must have fileName and mimeType" });
        }
      }

      const maxFileSize = this.r2ClientService.getMaxFileSize();
      const results = await this.r2ClientService.generatePresignedUrls(files);

      reply.send({
        status: "success",
        data: { urls: results, maxFileSize },
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error generating presigned URLs:", err);
      reply.status(500).send({ error: "Failed to generate presigned URLs: " + err.message });
    }
  }
}
