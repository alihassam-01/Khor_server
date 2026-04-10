import { FastifyInstance } from "fastify";
import { R2ClientController } from "@modules/user/controller";
import { authenticate } from "@middlewares/authenticate";
import { 
    IPresignedUrlRequestDTO, 
    IBatchPresignedUrlRequestDTO 
} from "@modules/user/dtos/r2-presigned.dto";

export async function r2ClientRoutes(fastify: FastifyInstance) {
  const r2ClientController = new R2ClientController();

  // Legacy: Upload file through backend (kept for backwards compatibility)
  fastify.post(
    "/r2/upload",
    { preHandler: authenticate },
    r2ClientController.uploadFile.bind(r2ClientController)
  );

  // Presigned URL: Get a single presigned URL for direct R2 upload
  fastify.post<{ Body: IPresignedUrlRequestDTO }>(
    "/r2/presigned-url",
    { preHandler: authenticate },
    r2ClientController.getPresignedUrl.bind(r2ClientController)
  );

  // Presigned URL: Get multiple presigned URLs for batch direct R2 upload
  fastify.post<{ Body: IBatchPresignedUrlRequestDTO }>(
    "/r2/presigned-urls",
    { preHandler: authenticate },
    r2ClientController.getPresignedUrls.bind(r2ClientController)
  );
}
