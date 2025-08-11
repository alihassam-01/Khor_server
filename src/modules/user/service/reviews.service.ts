import { AppDataSource } from "@config/ormconfig";
import { Review } from "@entity/review/review.entity";
import { Booking } from "@entity/bookings";
import { User } from "@entity/user";
import { ReviewStatus } from "@entity/ENUM/enum";
import { In } from "typeorm";
import { CreateReviewDTO, ReviewTargetType } from "../dtos/reviews.dto";

export class ReviewService {
  private reviewRepo = AppDataSource.getRepository(Review);
  private bookingRepo = AppDataSource.getRepository(Booking);
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Create a review if the user has a completed booking for the given target
   */
  async createReview(data: CreateReviewDTO) {
    const { userId, targetId, targetType, reviewText, rating } = data;
    const hasBooking = await this.bookingRepo.findOne({
      where: {
        customer: { id: userId },
        booking_status: In(["completed", "confirmed", "pending"]), // adjust as needed
        // [targetType]: { id: targetId },
      },
      relations: ["customer"], // load relation to filter correctly
    });
    if (!hasBooking) {
      throw new Error("You can only review items you have booked.");
    }

    const user = await this.userRepo.findOneByOrFail({ id: userId });
    if (!user) {
      throw new Error("User not found.");
    }
    const existingReview = await this.reviewRepo.findOne({
      where: {
        user: { id: userId },
        target_id: targetId,
        target_type: targetType,
      },
    });
    if (existingReview) {
      throw new Error("You have already submitted a review for this item.");
    }
    const review = this.reviewRepo.create({
      user,
      target_id: targetId,
      target_type: targetType,
      review_text: reviewText,
      rating,
      review_status: ReviewStatus.NOT_REVIEWED,
    });

    return await this.reviewRepo.save(review);
  }

  /**
   * Get reviews for a specific target
   */
  async getReviewsForTarget(targetId: string, targetType: ReviewTargetType) {
    const [reviews, count] = await this.reviewRepo.findAndCount({
      where: { target_id: targetId, target_type: targetType },
      relations: ["user.customerProfile", "user.vendor"],
      order: { review_date: "DESC" },
    });

    // Map reviews to only include username from customerProfile
    const mappedReviews = reviews.map((r) => ({
      review_id: r.review_id,
      review_text: r.review_text,
      rating: r.rating,
      review_date: r.review_date,
      review_status: r.review_status,
      helpful_count: r.helpful_count,
      not_helpful_count: r.not_helpful_count,
      target_id: r.target_id,
      target_type: r.target_type,
      profile_picture: r.user?.customerProfile?.profile_picture || r.user?.vendor?.profile_picture || "",
      user: {
        username:
          r.user?.customerProfile?.username ||
          `User-${r.user.id.slice(0, 6)}...`,
      },
    }));

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    return {
      reviews: mappedReviews,
      totalReviews: count,
      avgRating: Number(avgRating.toFixed(2)),
    };
  }

  /**
   * Get all reviews by a user
   */
  async getReviewsByUser(userId: string) {
    return await this.reviewRepo.find({
      where: { user: { id: userId } },
      relations: ["user"],
      order: { review_date: "DESC" },
    });
  }

  /**
   * Admin can approve/reject review
   */
  async updateReviewStatus(reviewId: number, status: ReviewStatus) {
    const review = await this.reviewRepo.findOneByOrFail({
      review_id: reviewId,
    });
    review.review_status = status;
    return await this.reviewRepo.save(review);
  }

  /**
   * Mark review as helpful or not
   */
  async markHelpful(reviewId: number, helpful: boolean) {
    const review = await this.reviewRepo.findOneByOrFail({
      review_id: reviewId,
    });

    if (helpful) review.helpful_count++;
    else review.not_helpful_count++;

    return await this.reviewRepo.save(review);
  }

  /**
   * Soft delete review
   */
  async deleteReview(reviewId: number, userId: string) {
    const review = await this.reviewRepo.findOneByOrFail({
      review_id: reviewId,
    });

    if (review.user.id !== userId) {
      throw new Error("Unauthorized to delete this review.");
    }

    review.is_deleted = true;
    return await this.reviewRepo.save(review);
  }

  // multiple reviews fetch using targetID[]
  async getReviewsByTargetIds(targetIds: string[]) {
    const reviews = await this.reviewRepo.find({
      where: { target_id: In(targetIds), is_deleted: false },
      relations: ["user.customerProfile"],
    });

    // Group reviews by target_id
    const grouped: Record<string, typeof reviews> = {};
    for (const r of reviews) {
      if (!grouped[r.target_id || ""]) grouped[r.target_id || ""] = [];
      grouped[r.target_id || ""].push(r);
    }

    // Map each group to include avgRating and totalReviews per target_id
    return Object.entries(grouped).map(([target_id, group]) => {
      const totalReviews = group.length;
      const avgRating =
        totalReviews > 0
          ? group.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
          : 0;

      return {
        target_id,
        totalReviews,
        avgRating: Number(avgRating.toFixed(2)),
        reviews: group.map((r) => ({
          review_id: r.review_id,
          review_text: r.review_text,
          rating: r.rating,
          review_date: r.review_date,
          review_status: r.review_status,
          helpful_count: r.helpful_count,
          not_helpful_count: r.not_helpful_count,
          target_type: r.target_type,
          user: {
            username:
              r.user?.customerProfile?.username ||
              `User-${r.user.id.slice(0, 6)}...`,
          },
        })),
      };
    });
  }
  /**
   * Get reviews by user ID
   */
  async getReviewsByUserId(userId: string) {
    return await this.reviewRepo.find({
      where: { user: { id: userId } },
      relations: ["user.customerProfile"],
      order: { review_date: "DESC" },
    });
  }
}
