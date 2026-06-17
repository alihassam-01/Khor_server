import { FastifyReply, FastifyRequest } from "fastify";
import { AdminPublicPolicyService } from "@modules/user/service/admin-public-policy.service";
import { IUpdatePublicPoliciesDto } from "@modules/user/types/public-policy.types";

export class AdminPublicPolicyController {
    constructor(private readonly service: AdminPublicPolicyService) {}

    async getCurrentPolicies(_request: FastifyRequest, reply: FastifyReply) {
        reply.send(await this.service.getCurrentPolicies());
    }

    async updateCurrentPolicies(
        request: FastifyRequest<{ Body: IUpdatePublicPoliciesDto }>,
        reply: FastifyReply,
    ) {
        reply.send(await this.service.updateCurrentPolicies(request.body));
    }
}
