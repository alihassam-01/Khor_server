import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { UserRole } from "@common/enums/user.enums";
import { ReviewStatus, ReviewTargetType } from "@common/enums/review.enums";
import { ReviewService } from "@modules/user/service/listing/review.service";

type AuthUser = {
    userId?: string;
    id?: string;
    userType?: UserRole;
};

type ReviewParams = {
    targetType: string;
    targetId: string;
};

type ReviewBody = {
    targetId: string;
    targetType: string;
    reviewText: string;
    rating: number;
    title?: string;
    aspectRatings?: {
        service: number;
        cleanliness: number;
        location: number;
        staff: number;
        environment: number;
    } | null;
};

type HelpfulParams = {
    id: string;
};

type EligibilityParams = {
    targetType: string;
    targetId: string;
};

type HelpfulBody = {
    helpful: boolean;
};

type TargetIdsBody = {
    targetIds: string[];
};

const toReviewTargetType = (value: string): ReviewTargetType => {
    const normalized = String(value).toLowerCase();
    if (normalized === "property") return ReviewTargetType.LISTING;
    if (normalized === "listing") return ReviewTargetType.LISTING;
    if (normalized === "room_type") return ReviewTargetType.ROOM_TYPE;
    if (normalized === "tour_package") return ReviewTargetType.TOUR_PACKAGE;
    if (normalized === "article") return ReviewTargetType.ARTICLE;
    if (normalized === "location") return ReviewTargetType.LOCATION;
    throw new AppError("Invalid review target type", 400, ErrorCodes.VALIDATION_ERROR);
};

export class ReviewController {
    private readonly reviewService = new ReviewService();

    private getAuthUser(req: FastifyRequest): { userId: string; userType: UserRole } {
        const user = (req.user ?? {}) as AuthUser;
        const userId = user.userId || user.id;
        const userType = user.userType;
        if (!userId || !userType) {
            throw new AppError("Authentication required", 401, ErrorCodes.UNAUTHORIZED);
        }
        return { userId, userType };
    }

    async listByTarget(
        req: FastifyRequest<{ Params: ReviewParams; Querystring: { status?: string; minRating?: string; page?: string; limit?: string } }>,
        reply: FastifyReply,
    ) {
        const targetType = toReviewTargetType(req.params.targetType);
        const result = await this.reviewService.list({
            target_type: targetType,
            target_id: req.params.targetId,
            status: req.query.status ? (req.query.status as ReviewStatus) : undefined,
            minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        });

        reply.send({
            items: result.items.map((item) => ({
                id: item.id,
                target_id: item.target_id,
                target_type: item.target_type,
                rating: item.rating,
                title: item.title ?? null,
                content: item.content,
                aspect_ratings: item.aspect_ratings ?? null,
                status: item.status,
                is_verified_booking: item.is_verified_booking,
                helpful_count: item.helpful_count,
                not_helpful_count: item.not_helpful_count,
                created_at: item.created_at,
                user: {
                    id: item.user?.id ?? item.user_id,
                    username: item.user?.profile?.username || item.user?.email || "Guest",
                    profile_picture: null,
                },
            })),
            total: result.total,
            page: result.page,
            limit: result.limit,
        });
    }

    async create(
        req: FastifyRequest<{ Body: ReviewBody }>,
        reply: FastifyReply,
    ) {
        const actor = this.getAuthUser(req);
        const saved = await this.reviewService.create({
            user_id: actor.userId,
            target_type: toReviewTargetType(req.body.targetType),
            target_id: req.body.targetId,
            rating: Number(req.body.rating),
            title: req.body.title?.trim() || null,
            content: req.body.reviewText,
            aspect_ratings: req.body.aspectRatings ?? null,
        });

        reply.code(201).send({
            id: saved.id,
            target_id: saved.target_id,
            target_type: saved.target_type,
            rating: saved.rating,
            title: saved.title ?? null,
            content: saved.content,
            aspect_ratings: saved.aspect_ratings ?? null,
            status: saved.status,
            is_verified_booking: saved.is_verified_booking,
            created_at: saved.created_at,
        });
    }

    async markHelpful(
        req: FastifyRequest<{ Params: HelpfulParams; Body: HelpfulBody }>,
        reply: FastifyReply,
    ) {
        const actor = this.getAuthUser(req);
        const updated = await this.reviewService.vote(req.params.id, actor.userId, !!req.body.helpful);
        reply.send({
            id: updated.id,
            helpful_count: updated.helpful_count,
            not_helpful_count: updated.not_helpful_count,
        });
    }

    async bulkByTargetIds(
        req: FastifyRequest<{ Body: TargetIdsBody }>,
        reply: FastifyReply,
    ) {
        const targetIds = Array.isArray(req.body?.targetIds) ? req.body.targetIds : [];
        const items = await this.reviewService.getAggregatesByTargetIds(targetIds);
        reply.send(items);
    }

    async eligibility(
        req: FastifyRequest<{ Params: EligibilityParams }>,
        reply: FastifyReply,
    ) {
        const actor = this.getAuthUser(req);
        const result = await this.reviewService.getEligibility(
            actor.userId,
            toReviewTargetType(req.params.targetType),
            req.params.targetId,
        );
        reply.send(result);
    }
}
