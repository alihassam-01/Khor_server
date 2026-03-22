import { FastifyInstance } from "fastify";
import { R2ClientController } from "@modules/user/controller";
import { authenticate } from "@middlewares/authenticate";

export async function r2ClientRoutes(fastify: FastifyInstance) {
  const r2ClientController = new R2ClientController();

  fastify.post(
    "/r2/upload",
    { preHandler: authenticate },
    r2ClientController.uploadFile.bind(r2ClientController)
  );
}
