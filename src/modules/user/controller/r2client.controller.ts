import { FastifyReply, FastifyRequest } from "fastify";
import { R2ClientService } from "@modules/user/service";
import { IPresignedUrlRequestDTO, IBatchPresignedUrlRequestDTO } from "@modules/user/dtos/r2-presigned.dto";
import * as fs from "fs";

export class R2ClientController {
  private r2ClientService: R2ClientService;

  constructor() {
    this.r2ClientService = new R2ClientService();
  }

  /**
   * Legacy: Upload file through backend (kept for backwards compatibility)
   */
  async uploadFile(req: FastifyRequest, reply: FastifyReply) {
    try {
      // @ts-ignore
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
    } catch (error: any) {
      console.error("Error uploading files:", error);
      reply.status(500).send({ error: "Upload failed" });
    }
  }

  /**
   * Generate a single presigned URL for direct R2 upload
   */
  async getPresignedUrl(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { fileName, mimeType, folder } = req.body as IPresignedUrlRequestDTO;

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
    } catch (error: any) {
      console.error("Error generating presigned URL:", error);
      reply.status(500).send({ error: "Failed to generate presigned URL" });
    }
  }

  /**
   * Generate multiple presigned URLs for batch direct R2 upload
   */
  async getPresignedUrls(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { files } = req.body as IBatchPresignedUrlRequestDTO;

      if (!files || !Array.isArray(files) || files.length === 0) {
        return reply.status(400).send({ error: "files array is required and must not be empty" });
      }

      // Validate each file entry
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
    } catch (error: any) {
      console.error("Error generating presigned URLs:", error);
      reply.status(500).send({ error: "Failed to generate presigned URLs" });
    }
  }
}
