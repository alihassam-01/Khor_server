import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { BusinessCapabilityType } from "@common/enums/business.enums";
import { AdminBusinessReviewService } from "@modules/user/service/admin-business-review.service";
import {
    IReviewBusinessCapabilityDto,
    IReviewBusinessProfileDto,
} from "@modules/user/types/admin-business-review.types";

type BusinessParams = {
    id: string;
};

type CapabilityParams = {
    id: string;
    capabilityType: BusinessCapabilityType;
};

export class AdminBusinessReviewController {
    constructor(private readonly service: AdminBusinessReviewService) {}

    private resolveAdminUserId(request: FastifyRequest): string | undefined {
        return (request.user as any)?.userId || (request.user as any)?.id;
    }

    async listBusinesses(_request: FastifyRequest, reply: FastifyReply) {
        const businesses = await this.service.listBusinesses();
        reply.send(businesses);
    }

    async getBusiness(
        request: FastifyRequest<{ Params: BusinessParams }>,
        reply: FastifyReply,
    ) {
        const business = await this.service.getBusiness(request.params.id);
        reply.send(business);
    }

    async reviewProfile(
        request: FastifyRequest<{ Params: BusinessParams; Body: IReviewBusinessProfileDto }>,
        reply: FastifyReply,
    ) {
        if (!request.body?.status) {
            throw new AppError("Review status is required", 400, ErrorCodes.BAD_REQUEST);
        }
        const business = await this.service.reviewProfile(
            request.params.id,
            request.body,
            this.resolveAdminUserId(request),
        );
        reply.send(business);
    }

    async reviewCapability(
        request: FastifyRequest<{ Params: CapabilityParams; Body: IReviewBusinessCapabilityDto }>,
        reply: FastifyReply,
    ) {
        if (!request.body?.action) {
            throw new AppError("Capability review action is required", 400, ErrorCodes.BAD_REQUEST);
        }
        const business = await this.service.reviewCapability(
            request.params.id,
            request.params.capabilityType,
            request.body,
            this.resolveAdminUserId(request),
        );
        reply.send(business);
    }
}
