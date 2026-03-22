import { FastifyReply, FastifyRequest } from "fastify";
import { R2ClientService } from "@modules/user/service";
import * as fs from "fs";
export class R2ClientController {
  private r2ClientService: R2ClientService;

  constructor() {
    this.r2ClientService = new R2ClientService();
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
}
