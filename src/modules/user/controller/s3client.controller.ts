import { FastifyReply, FastifyRequest } from "fastify";
import { S3ClientService } from "../service";
import * as fs from "fs";
export class S3ClientController {
  private s3ClientService: S3ClientService;

  constructor() {
    this.s3ClientService = new S3ClientService();
  }

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
        const result = await this.s3ClientService.uploadFileToS3(
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
}
