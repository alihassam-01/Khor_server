import { FastifyInstance } from "fastify";
import { PayoutController } from "../controller";
import { PayoutService } from "../service";

export default async function PayoutRoutes(fastify: FastifyInstance) {
  const payoutService = new PayoutService();
  const payoutController = new PayoutController(payoutService);

  fastify.get("/payouts", payoutController.getAll.bind(payoutController));
  fastify.put(
    "/payouts/:id/status",
    payoutController.updateStatus.bind(payoutController)
  );
}
