import { AppDataSource } from "@config/ormconfig";
import { EntityManager } from "typeorm";
import { Review } from "@modules/user/entity/review/review.entity";
import { ReviewVote } from "@modules/user/entity/review/review-vote.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";
import {
    ReviewStatus,
    ReviewTargetType,
} from "@common/enums/review.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { isValidUuid } from "@common/utils/uuid.util";
import { logInfo } from "@lib/logger";

export interface ICreateReviewInput {
    user_id: string;
    target_type: ReviewTargetType;
    target_id: string;
    rating: number;
    title?: string | null;
    content: string;
}

export interface IUpdateReviewInput {
    rating?: number;
    title?: string | null;
    content?: string;
    status?: ReviewStatus;
}

export interface IReviewListParams {
    target_type: ReviewTargetType;
    target_id: string;
    page?: number;
    limit?: number;
    status?: ReviewStatus;
    minRating?: number;
}

const ratingTablesByTarget: Partial<Record<ReviewTargetType, { entity: Function; idField: string }>> = {
    [ReviewTargetType.LISTING]: { entity: Listing, idField: "id" },
    [ReviewTargetType.ROOM_TYPE]: { entity: HotelRoomType, idField: "id" },
};

/**
 * Single point of access for the polymorphic `reviews` table. Maintains the
 * cached aggregates (`rating_avg`, `rating_count`) on the target row inside
 * the same transaction as the underlying review CRUD. Vote handling lives
 * here too because helpful/unhelpful counters are denormalized onto Review.
 */
export class ReviewService {
    private validate(input: ICreateReviewInput | IUpdateReviewInput): void {
        if ("rating" in input && input.rating !== undefined) {
            if (input.rating < 1 || input.rating > 5) {
                throw new AppError(
                    "Rating must be between 1 and 5.",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }
        }
        if ("content" in input && input.content !== undefined) {
            if (!input.content.trim()) {
                throw new AppError(
                    "Review content cannot be empty.",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }
        }
    }

    private async assertTargetExists(
        em: EntityManager,
        targetType: ReviewTargetType,
        targetId: string,
    ): Promise<void> {
        const def = ratingTablesByTarget[targetType];
        if (!def) return; // articles, locations not enforced here
        if (!isValidUuid(targetId)) {
            throw new AppError(
                `Invalid ${targetType} ID format.`,
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }
        const row = await em.getRepository(def.entity as any).findOne({
            where: { [def.idField]: targetId },
        });
        if (!row) {
            throw new AppError(`${targetType} not found.`, 404, ErrorCodes.NOT_FOUND);
        }
    }

    async create(input: ICreateReviewInput): Promise<Review> {
        this.validate(input);
        return AppDataSource.transaction(async (em) => {
            await this.assertTargetExists(em, input.target_type, input.target_id);

            const review = new Review();
            review.user_id = input.user_id;
            review.target_type = input.target_type;
            review.target_id = input.target_id;
            review.rating = Math.round(input.rating);
            review.title = input.title ?? null;
            review.content = input.content;
            review.status = ReviewStatus.PENDING;
            const saved = await em.getRepository(Review).save(review);

            await this.recomputeAggregates(em, input.target_type, input.target_id);
            logInfo("Review created", { id: saved.id, target_type: saved.target_type, target_id: saved.target_id });
            return saved;
        });
    }

    async update(reviewId: string, userId: string | null, patch: IUpdateReviewInput): Promise<Review> {
        this.validate(patch);
        return AppDataSource.transaction(async (em) => {
            const repo = em.getRepository(Review);
            const review = await repo.findOne({ where: { id: reviewId } });
            if (!review) {
                throw new AppError("Review not found.", 404, ErrorCodes.NOT_FOUND);
            }
            if (userId && review.user_id !== userId && patch.status === undefined) {
                throw new AppError("You can only edit your own review.", 403, ErrorCodes.FORBIDDEN);
            }
            if (patch.rating !== undefined) review.rating = Math.round(patch.rating);
            if (patch.title !== undefined) review.title = patch.title ?? null;
            if (patch.content !== undefined) review.content = patch.content;
            if (patch.status !== undefined) review.status = patch.status;
            const saved = await repo.save(review);
            await this.recomputeAggregates(em, review.target_type, review.target_id);
            return saved;
        });
    }

    async delete(reviewId: string, userId: string | null): Promise<void> {
        await AppDataSource.transaction(async (em) => {
            const repo = em.getRepository(Review);
            const review = await repo.findOne({ where: { id: reviewId } });
            if (!review) {
                throw new AppError("Review not found.", 404, ErrorCodes.NOT_FOUND);
            }
            if (userId && review.user_id !== userId) {
                throw new AppError("You can only delete your own review.", 403, ErrorCodes.FORBIDDEN);
            }
            await repo.remove(review);
            await this.recomputeAggregates(em, review.target_type, review.target_id);
        });
    }

    async list(params: IReviewListParams): Promise<{ items: Review[]; total: number; page: number; limit: number }> {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;
        const skip = (page - 1) * limit;
        const qb = AppDataSource.getRepository(Review)
            .createQueryBuilder("review")
            .leftJoinAndSelect("review.user", "user")
            .leftJoinAndSelect("user.profile", "profile")
            .where("review.target_type = :tt", { tt: params.target_type })
            .andWhere("review.target_id = :tid", { tid: params.target_id });
        if (params.status) {
            qb.andWhere("review.status = :status", { status: params.status });
        } else {
            qb.andWhere("review.status = :status", { status: ReviewStatus.PUBLISHED });
        }
        if (params.minRating) {
            qb.andWhere("review.rating >= :min", { min: params.minRating });
        }
        qb.orderBy("review.created_at", "DESC").skip(skip).take(limit);
        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, limit };
    }

    /**
     * Cast or change a vote on a review. Updates the denormalized
     * `helpful_count` / `not_helpful_count` on the Review row.
     */
    async vote(reviewId: string, userId: string, isHelpful: boolean): Promise<Review> {
        return AppDataSource.transaction(async (em) => {
            const reviewRepo = em.getRepository(Review);
            const voteRepo = em.getRepository(ReviewVote);
            const review = await reviewRepo.findOne({ where: { id: reviewId } });
            if (!review) {
                throw new AppError("Review not found.", 404, ErrorCodes.NOT_FOUND);
            }

            const existing = await voteRepo.findOne({ where: { review_id: reviewId, user_id: userId } });
            if (existing && existing.is_helpful === isHelpful) {
                return review; // no-op
            }
            if (existing) {
                existing.is_helpful = isHelpful;
                await voteRepo.save(existing);
            } else {
                const vote = new ReviewVote();
                vote.review_id = reviewId;
                vote.user_id = userId;
                vote.is_helpful = isHelpful;
                await voteRepo.save(vote);
            }
            await this.recomputeVoteCounters(em, reviewId);
            return reviewRepo.findOne({ where: { id: reviewId } }) as Promise<Review>;
        });
    }

    async unvote(reviewId: string, userId: string): Promise<Review> {
        return AppDataSource.transaction(async (em) => {
            const voteRepo = em.getRepository(ReviewVote);
            const reviewRepo = em.getRepository(Review);
            const existing = await voteRepo.findOne({ where: { review_id: reviewId, user_id: userId } });
            if (existing) {
                await voteRepo.remove(existing);
                await this.recomputeVoteCounters(em, reviewId);
            }
            const review = await reviewRepo.findOne({ where: { id: reviewId } });
            if (!review) {
                throw new AppError("Review not found.", 404, ErrorCodes.NOT_FOUND);
            }
            return review;
        });
    }

    /** Recompute `rating_avg` / `rating_count` on the target row. */
    private async recomputeAggregates(
        em: EntityManager,
        targetType: ReviewTargetType,
        targetId: string,
    ): Promise<void> {
        const def = ratingTablesByTarget[targetType];
        if (!def) return;

        const row = await em.getRepository(Review)
            .createQueryBuilder("r")
            .select("COALESCE(AVG(r.rating), 0)", "avg")
            .addSelect("COUNT(*)::int", "count")
            .where("r.target_type = :tt AND r.target_id = :tid AND r.status = :pub", {
                tt: targetType,
                tid: targetId,
                pub: ReviewStatus.PUBLISHED,
            })
            .getRawOne<{ avg: string; count: number }>();

        const avg = Number(row?.avg ?? 0);
        const count = Number(row?.count ?? 0);
        await em.getRepository(def.entity as any)
            .update({ [def.idField]: targetId } as any, {
                rating_avg: Math.round(avg * 100) / 100,
                rating_count: count,
            } as any);
    }

    private async recomputeVoteCounters(em: EntityManager, reviewId: string): Promise<void> {
        const row = await em.getRepository(ReviewVote)
            .createQueryBuilder("v")
            .select("SUM(CASE WHEN v.is_helpful THEN 1 ELSE 0 END)::int", "helpful")
            .addSelect("SUM(CASE WHEN NOT v.is_helpful THEN 1 ELSE 0 END)::int", "not_helpful")
            .where("v.review_id = :id", { id: reviewId })
            .getRawOne<{ helpful: number; not_helpful: number }>();
        await em.getRepository(Review).update(
            { id: reviewId },
            {
                helpful_count: Number(row?.helpful ?? 0),
                not_helpful_count: Number(row?.not_helpful ?? 0),
            },
        );
    }
}
