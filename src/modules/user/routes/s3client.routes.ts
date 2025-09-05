import { FastifyInstance } from "fastify";
import { S3ClientController } from "../controller";
import { authenticate } from "../../../middlewares/authenticate";

export async function s3ClientRoutes(fastify: FastifyInstance) {
  const s3ClientController = new S3ClientController();

  fastify.post(
    "/s3/upload",
    { preHandler: authenticate },
    s3ClientController.uploadFile.bind(s3ClientController)
  );
}
