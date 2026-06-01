import { AppDataSource } from "@config/ormconfig";
import { EntityManager } from "typeorm";
import { Review } from "@modules/user/entity/review/review.entity";
import { ReviewAspectRatings } from "@modules/user/entity/review/review.entity";
import { ReviewVote } from "@modules/user/entity/review/review-vote.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";
import { HotelBooking } from "@modules/user/entity/booking/hotel-booking.entity";
import {
    BookingPaymentStatus,
    BookingSource,
    HotelBookingStatus,
} from "@common/enums/booking.enums";
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
    aspect_ratings?: ReviewAspectRatings | null;
}

export interface IUpdateReviewInput {
    rating?: number;
    title?: string | null;
    content?: string;
    status?: ReviewStatus;
    aspect_ratings?: ReviewAspectRatings | null;
}

export interface IReviewListParams {
    target_type: ReviewTargetType;
    target_id: string;
    page?: number;
    limit?: number;
    status?: ReviewStatus;
    minRating?: number;
}

export interface IReviewEligibilityResult {
    canReview: boolean;
    alreadyReviewed: boolean;
    isVerifiedBookingRequired: boolean;
    existingReviewId?: string | null;
    reason?: string | null;
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
    private readonly eligiblePaidStatuses = [
        BookingPaymentStatus.PAID,
        BookingPaymentStatus.PARTIALLY_REFUNDED,
        BookingPaymentStatus.REFUNDED,
    ] as const;

    private readonly hotelAspectKeys: Array<keyof ReviewAspectRatings> = [
        "service",
        "cleanliness",
        "location",
        "staff",
        "environment",
    ];

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
        if ("aspect_ratings" in input && input.aspect_ratings !== undefined && input.aspect_ratings !== null) {
            for (const key of this.hotelAspectKeys) {
                const value = Number(input.aspect_ratings[key]);
                if (!Number.isFinite(value) || value < 1 || value > 5) {
                    throw new AppError(
                        `Review ${key} rating must be between 1 and 5.`,
                        400,
                        ErrorCodes.VALIDATION_ERROR,
                    );
                }
            }
        }
    }

    private normalizeAspectRatings(
        aspectRatings?: ReviewAspectRatings | null,
    ): ReviewAspectRatings | null {
        if (!aspectRatings) return null;
        const normalized = {} as ReviewAspectRatings;
        for (const key of this.hotelAspectKeys) {
            normalized[key] = Math.round(Number(aspectRatings[key]));
        }
        return normalized;
    }

    private computeOverallRating(
        rating: number | undefined,
        aspectRatings?: ReviewAspectRatings | null,
    ): number {
        if (aspectRatings) {
            const values = this.hotelAspectKeys.map((key) => Number(aspectRatings[key]));
            const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
            return Math.round(avg);
        }
        return Math.round(Number(rating ?? 0));
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

    private async assertEligiblePaidReviewer(
        em: EntityManager,
        userId: string,
        targetType: ReviewTargetType,
        targetId: string,
    ): Promise<boolean> {
        if (targetType !== ReviewTargetType.LISTING && targetType !== ReviewTargetType.ROOM_TYPE) {
            return false;
        }

        const qb = em.getRepository(HotelBooking)
            .createQueryBuilder("booking")
            .where("booking.customer_user_id = :userId", { userId })
            .andWhere("booking.source = :source", { source: BookingSource.CUSTOMER_WEB })
            .andWhere("booking.payment_status IN (:...statuses)", {
                statuses: [...this.eligiblePaidStatuses],
            })
            .andWhere("booking.booking_status IN (:...bookingStatuses)", {
                bookingStatuses: [
                    HotelBookingStatus.CONFIRMED,
                    HotelBookingStatus.CHECKED_IN,
                    HotelBookingStatus.COMPLETED,
                ],
            })
            .andWhere("booking.check_out_date <= CURRENT_DATE");

        if (targetType === ReviewTargetType.LISTING) {
            qb.andWhere("booking.listing_id = :targetId", { targetId });
        } else {
            qb.andWhere("booking.room_type_id = :targetId", { targetId });
        }

        const eligibleBooking = await qb.getOne();
        return !!eligibleBooking;
    }

    async getEligibility(
        userId: string,
        targetType: ReviewTargetType,
        targetId: string,
    ): Promise<IReviewEligibilityResult> {
        return AppDataSource.transaction(async (em) => {
            await this.assertTargetExists(em, targetType, targetId);

            const existing = await em.getRepository(Review).findOne({
                where: {
                    user_id: userId,
                    target_type: targetType,
                    target_id: targetId,
                },
            });

            if (existing) {
                return {
                    canReview: false,
                    alreadyReviewed: true,
                    isVerifiedBookingRequired:
                        targetType === ReviewTargetType.LISTING || targetType === ReviewTargetType.ROOM_TYPE,
                    existingReviewId: existing.id,
                    reason: "You have already reviewed this stay.",
                };
            }

            if (targetType === ReviewTargetType.LISTING || targetType === ReviewTargetType.ROOM_TYPE) {
                const isEligible = await this.assertEligiblePaidReviewer(em, userId, targetType, targetId);
                return {
                    canReview: isEligible,
                    alreadyReviewed: false,
                    isVerifiedBookingRequired: true,
                    existingReviewId: null,
                    reason: isEligible
                        ? null
                        : "Only customers with a completed paid stay can review this hotel.",
                };
            }

            return {
                canReview: true,
                alreadyReviewed: false,
                isVerifiedBookingRequired: false,
                existingReviewId: null,
                reason: null,
            };
        });
    }

    async create(input: ICreateReviewInput): Promise<Review> {
        this.validate(input);
        return AppDataSource.transaction(async (em) => {
            await this.assertTargetExists(em, input.target_type, input.target_id);

            const existing = await em.getRepository(Review).findOne({
                where: {
                    user_id: input.user_id,
                    target_type: input.target_type,
                    target_id: input.target_id,
                },
            });
            if (existing) {
                throw new AppError(
                    "You have already reviewed this stay.",
                    409,
                    ErrorCodes.CONFLICT,
                );
            }

            let isVerifiedBooking = false;
            if (input.target_type === ReviewTargetType.LISTING || input.target_type === ReviewTargetType.ROOM_TYPE) {
                if (!input.aspect_ratings) {
                    throw new AppError(
                        "Detailed hotel ratings are required for service, cleanliness, location, staff, and environment.",
                        400,
                        ErrorCodes.VALIDATION_ERROR,
                    );
                }
                isVerifiedBooking = await this.assertEligiblePaidReviewer(
                    em,
                    input.user_id,
                    input.target_type,
                    input.target_id,
                );

                if (!isVerifiedBooking) {
                    throw new AppError(
                        "Only customers with a completed paid stay can review this hotel.",
                        403,
                        ErrorCodes.FORBIDDEN,
                    );
                }
            }

            const review = new Review();
            review.user_id = input.user_id;
            review.target_type = input.target_type;
            review.target_id = input.target_id;
            review.aspect_ratings = this.normalizeAspectRatings(input.aspect_ratings);
            review.rating = this.computeOverallRating(input.rating, review.aspect_ratings);
            review.title = input.title ?? null;
            review.content = input.content;
            review.is_verified_booking = isVerifiedBooking;
            review.status = isVerifiedBooking ? ReviewStatus.PUBLISHED : ReviewStatus.PENDING;
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
            if (patch.aspect_ratings !== undefined) {
                review.aspect_ratings = this.normalizeAspectRatings(patch.aspect_ratings);
            }
            if (patch.rating !== undefined || patch.aspect_ratings !== undefined) {
                review.rating = this.computeOverallRating(patch.rating ?? review.rating, review.aspect_ratings);
            }
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

    async getAggregatesByTargetIds(targetIds: string[]): Promise<Array<{ target_id: string; avgRating: number; totalReviews: number }>> {
        if (targetIds.length === 0) return [];

        const rows = await AppDataSource.getRepository(Review)
            .createQueryBuilder("review")
            .select("review.target_id", "target_id")
            .addSelect("COALESCE(AVG(review.rating), 0)", "avg_rating")
            .addSelect("COUNT(*)::int", "total_reviews")
            .where("review.target_id IN (:...targetIds)", { targetIds })
            .andWhere("review.status = :status", { status: ReviewStatus.PUBLISHED })
            .groupBy("review.target_id")
            .getRawMany<{ target_id: string; avg_rating: string; total_reviews: string }>();

        return rows.map((row) => ({
            target_id: row.target_id,
            avgRating: Math.round(Number(row.avg_rating ?? 0) * 100) / 100,
            totalReviews: Number(row.total_reviews ?? 0),
        }));
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
