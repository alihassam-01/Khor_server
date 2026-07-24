import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { PartnerOnboardingController } from "@modules/user/controller/partner-onboarding.controller";
import { PartnerOnboardingService } from "@modules/user/service/partner-onboarding.service";
import { IBusinessProfileUpsertDto } from "@modules/user/types/business-onboarding.types";
import { ISubmitBusinessProfileForReviewDto } from "@modules/user/types/business-onboarding.types";
import {
    IAcceptCurrentPolicyDto,
    IBusinessDocumentPresignRequestDto,
    ICompleteBusinessDocumentUploadDto,
} from "@modules/user/types/business-documents.types";
import { RATE_LIMITS } from "@config/rate-limit.config";

export default async function partnerOnboardingRoutes(fastify: FastifyInstance) {
    const service = new PartnerOnboardingService();
    const controller = new PartnerOnboardingController(service);

    fastify.get("/partner/business-profile", { preHandler: [authenticate] }, controller.getProfile.bind(controller));
    fastify.put<{ Body: IBusinessProfileUpsertDto }>(
        "/partner/business-profile",
        { preHandler: [authenticate] },
        controller.upsertProfile.bind(controller),
    );
    fastify.post<{ Body: ISubmitBusinessProfileForReviewDto }>(
        "/partner/onboarding/submit",
        { preHandler: [authenticate] },
        controller.submitForReview.bind(controller),
    );
    fastify.get("/partner/policies/current", controller.getCurrentPolicy.bind(controller));
    fastify.post<{ Body: IAcceptCurrentPolicyDto }>(
        "/partner/policies/accept",
        { preHandler: [authenticate] },
        controller.acceptCurrentPolicy.bind(controller),
    );
    fastify.post<{ Body: IBusinessDocumentPresignRequestDto }>(
        "/partner/documents/presign",
        { preHandler: [authenticate], config: { rateLimit: RATE_LIMITS.upload } },
        controller.createDocumentPresign.bind(controller),
    );
    fastify.post<{ Body: ICompleteBusinessDocumentUploadDto }>(
        "/partner/documents/complete",
        { preHandler: [authenticate], config: { rateLimit: RATE_LIMITS.upload } },
        controller.completeDocumentUpload.bind(controller),
    );
}
