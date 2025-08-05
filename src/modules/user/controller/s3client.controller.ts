import { FastifyReply, FastifyRequest } from "fastify";
import { S3ClientService } from "../service";
export class S3ClientController {
  private s3ClientService: S3ClientService;

  constructor() {
    this.s3ClientService = new S3ClientService();
  }

  async uploadFile(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: "No file provided" });
      } 
      const buffer = await data.toBuffer();
      const result = await this.s3ClientService.uploadFileToS3(
        buffer,
        data.filename,
        data.mimetype
      );
      reply.send({ status: "success", data: result });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      reply.status(500).send({ error: "Upload failed" });
    }
  }
}
