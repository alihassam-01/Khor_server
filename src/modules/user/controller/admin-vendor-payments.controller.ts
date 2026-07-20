import { FastifyRequest, FastifyReply } from "fastify";
import { AdminVendorPaymentsService } from "@modules/user/service/admin-vendor-payments.service";

export class AdminVendorPaymentsController {
    private service = new AdminVendorPaymentsService();

    async getMonthlyOverview(req: FastifyRequest, reply: FastifyReply) {
        try {
            const query = req.query as any;
            const now = new Date();
            const month = query.month ? parseInt(query.month) : now.getMonth() + 1;
            const year = query.year ? parseInt(query.year) : now.getFullYear();

            const data = await this.service.getMonthlyOverview(month, year);
            reply.status(200).send(data);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }

    async getVendorLedger(req: FastifyRequest, reply: FastifyReply) {
        try {
            const params = req.params as any;
            const vendorId = params.vendorId;
            const data = await this.service.getVendorLedger(vendorId);
            reply.status(200).send(data);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }

    async recordSubscriptionPayment(req: FastifyRequest, reply: FastifyReply) {
        try {
            const adminUserId = (req.user as any).id;
            const data = await this.service.recordSubscriptionPayment(req.body as any, adminUserId);
            reply.status(200).send(data);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }

    async updateSubscriptionType(req: FastifyRequest, reply: FastifyReply) {
        try {
            const params = req.params as any;
            const vendorId = params.vendorId;
            const body = req.body as any;
            const subscriptionType = body.subscription_type;
            const data = await this.service.updateSubscriptionType(vendorId, subscriptionType);
            reply.status(200).send(data);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }
}
