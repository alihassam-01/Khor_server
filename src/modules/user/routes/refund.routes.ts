import { FastifyInstance } from "fastify";
import { RefundController } from "../controller";

export default async function refundRoutes(fastify: FastifyInstance) {
  const refundController = new RefundController();
  fastify.get("/refund", refundController.getAllRefund.bind(refundController));
  fastify.get("/refund/:id", refundController.getRefund.bind(refundController));
  fastify.put(
    "/refund/:id",
    refundController.updateRefund.bind(refundController)
  );
  fastify.delete(
    "/refund/:id",
    refundController.deleteRefund.bind(refundController)
  );
}
