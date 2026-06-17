import { FastifyReply, FastifyRequest } from "fastify";
import { AdminVendorPolicyService } from "@modules/user/service/admin-vendor-policy.service";
import { IUpdateVendorPolicyDto } from "@modules/user/types/vendor-policy.types";

export class AdminVendorPolicyController {
    constructor(private readonly service: AdminVendorPolicyService) {}

    async getCurrentPolicy(_request: FastifyRequest, reply: FastifyReply) {
        reply.send(await this.service.getCurrentPolicy());
    }

    async updateCurrentPolicy(
        request: FastifyRequest<{ Body: IUpdateVendorPolicyDto }>,
        reply: FastifyReply,
    ) {
        reply.send(await this.service.updateCurrentPolicy(request.body));
    }
}
