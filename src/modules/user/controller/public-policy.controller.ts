import { FastifyReply, FastifyRequest } from "fastify";
import { PublicPolicyService } from "@modules/user/service/public-policy.service";

export class PublicPolicyController {
    private readonly service = new PublicPolicyService();

    async getCurrentPolicies(_request: FastifyRequest, reply: FastifyReply) {
        reply.send(await this.service.getCurrentPolicies());
    }
}
