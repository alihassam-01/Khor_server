import { FastifyReply, FastifyRequest } from "fastify";
import { PayoutService } from "../service";
// import { Payout } from "../entity/payout";

export class PayoutController{
  constructor(private readonly payoutService: PayoutService) {}

    // async createPayout(req: FastifyRequest<{ Body: Partial<Payout> }>, reply: FastifyReply) {
    //     try {
    //     const payout = await this.payoutService.create(req.body);
    //     reply.code(201).send(payout);
    //     } catch (error: any) {
    //     this.handleError(error, reply);
    //     }
    // }

    async updateStatus(req: FastifyRequest<{ Params: { id: string }; Body: { status: "pending" | "completed" | "failed" } }>, reply: FastifyReply) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const updatedPayout = await this.payoutService.updateStatus(id, status);
            if (!updatedPayout) {
                reply.code(404).send({ error: "Payout not found" });
                return;
            }
            reply.send(updatedPayout);
        } catch (error: any) {
            this.handleError(error, reply);
        }
    }

    async getAll(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const payouts = await this.payoutService.findAll();
            reply.send(payouts);
        } catch (error: any) {
            this.handleError(error, reply);
        }
    }

    private handleError(error: any, reply: FastifyReply) {
        console.error(error);
        reply.code(500).send({ error: "Internal Server Error" });
    }

}