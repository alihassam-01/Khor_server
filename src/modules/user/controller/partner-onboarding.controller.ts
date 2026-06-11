import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { PartnerOnboardingService } from "@modules/user/service/partner-onboarding.service";
import {
    IBusinessProfileUpsertDto,
    ISubmitBusinessProfileForReviewDto,
} from "@modules/user/types/business-onboarding.types";
import {
    IAcceptCurrentPolicyDto,
    IBusinessDocumentPresignRequestDto,
    ICompleteBusinessDocumentUploadDto,
} from "@modules/user/types/business-documents.types";

export class PartnerOnboardingController {
    constructor(private readonly service: PartnerOnboardingService) {}

    private resolveUserId(request: FastifyRequest): string {
        const userId = (request.user as any)?.userId || (request.user as any)?.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED);
        }
        return userId;
    }

    async getProfile(request: FastifyRequest, reply: FastifyReply) {
        const profile = await this.service.getProfileForUser(this.resolveUserId(request));
        reply.send(profile);
    }

    async upsertProfile(
        request: FastifyRequest<{ Body: IBusinessProfileUpsertDto }>,
        reply: FastifyReply,
    ) {
        const profile = await this.service.upsertProfileForUser(this.resolveUserId(request), request.body);
        reply.send(profile);
    }

    async submitForReview(
        request: FastifyRequest<{ Body: ISubmitBusinessProfileForReviewDto }>,
        reply: FastifyReply,
    ) {
        const profile = await this.service.submitForReview(
            this.resolveUserId(request),
            request.body,
            request.ip,
            request.headers["user-agent"] ?? null,
        );
        reply.send(profile);
    }

    async getCurrentPolicy(_request: FastifyRequest, reply: FastifyReply) {
        reply.send(await this.service.getCurrentPolicy());
    }

    async acceptCurrentPolicy(
        request: FastifyRequest<{ Body: IAcceptCurrentPolicyDto }>,
        reply: FastifyReply,
    ) {
        const result = await this.service.acceptCurrentPolicy(
            this.resolveUserId(request),
            request.body,
            request.ip,
            request.headers["user-agent"] ?? null,
        );
        reply.send(result);
    }

    async createDocumentPresign(
        request: FastifyRequest<{ Body: IBusinessDocumentPresignRequestDto }>,
        reply: FastifyReply,
    ) {
        const result = await this.service.createDocumentPresign(this.resolveUserId(request), request.body);
        reply.send(result);
    }

    async completeDocumentUpload(
        request: FastifyRequest<{ Body: ICompleteBusinessDocumentUploadDto }>,
        reply: FastifyReply,
    ) {
        const result = await this.service.completeDocumentUpload(this.resolveUserId(request), request.body);
        reply.send(result);
    }
}
