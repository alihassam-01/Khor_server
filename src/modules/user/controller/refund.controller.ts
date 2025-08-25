import { FastifyReply, FastifyRequest } from "fastify";
import { RefundService } from "../service";
import { Refund } from "../entity/bookings";

export class RefundController {
  private refundService = new RefundService();

  // async createRefund(
  //     req: FastifyRequest<{ Body: { amount: number } }>,
  //     reply: FastifyReply) {
  //     const refund = await this.refundService.create(req.body);
  //     reply.send(refund);
  // }
  async getAllRefund(_req: FastifyRequest, reply: FastifyReply) {
    const refunds = await this.refundService.findAll();
    reply.send(refunds);
  }

  async getRefund(
    req: FastifyRequest<{ Params: { vendorId: string } }>,
    reply: FastifyReply
  ) {
    const refund = await this.refundService.findOne(req.params.vendorId);
    reply.send(refund);
  }

  async updateRefund(
    req: FastifyRequest<{
      Params: { vendorId: string };
      Body: { refund: Refund };
    }>,
    reply: FastifyReply
  ) {
    const refund = await this.refundService.update(
      req.params.vendorId,
      req.body.refund
    );
    reply.send(refund);
  }

  async deleteRefund(
    req: FastifyRequest<{ Params: { vendorId: string } }>,
    reply: FastifyReply
  ) {
    const success = await this.refundService.delete(req.params.vendorId);
    reply.send({ success });
  }
}
