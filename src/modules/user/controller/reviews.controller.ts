import { FastifyRequest, FastifyReply } from "fastify";
import { ReviewService } from "../../user/service";
import { ReviewStatus } from "../entity/ENUM/enum";
import { CreateReviewDTO } from "../dtos/reviews.dto";

const reviewService = new ReviewService();

export const ReviewController = {
  // Create a new review
  async createReview(
    request: FastifyRequest<{
      Body: CreateReviewDTO;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { targetId, targetType, reviewText, rating, userId } = request.body;

      const review = await reviewService.createReview({
        userId,
        targetId,
        targetType,
        reviewText,
        rating,
      });

      return reply.status(201).send(review);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  },

  // Get reviews for a target
  async getReviewsForTarget(
    request: FastifyRequest<{
      Params: {
        targetId: string;
        targetType: "property" | "room_type" | "tour_package" | "article";
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { targetId, targetType } = request.params;
      const reviews = await reviewService.getReviewsForTarget(
        targetId,
        targetType
      );
      return reply.send(reviews);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  },

  // Get reviews by the logged-in user
  //   async getUserReviews(request: FastifyRequest, reply: FastifyReply) {
  //     try {
  //       const userId = (request.user as any).id;
  //       const reviews = await reviewService.getReviewsByUser(userId);
  //       return reply.send(reviews);
  //     } catch (err: any) {
  //       return reply.status(400).send({ message: err.message });
  //     }
  //   },

  // Admin updates review status
  async updateReviewStatus(
    request: FastifyRequest<{
      Body: {
        status: ReviewStatus;
      };
      Params: { reviewId: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { reviewId } = request.params;
      const { status } = request.body;

      const result = await reviewService.updateReviewStatus(
        parseInt(reviewId),
        status
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  },

  // Mark a review helpful or not
  async markHelpful(
    request: FastifyRequest<{
      Body: {
        helpful: boolean;
      };
      Params: { reviewId: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { reviewId } = request.params;
      const { helpful } = request.body;

      const result = await reviewService.markHelpful(
        parseInt(reviewId),
        helpful
      );
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  },
  // getReviewsByTargetIds
  async getReviewsByTargetIds(
    req: FastifyRequest<{
      Body: { targetIds?: string[] };
    }>,
    reply: FastifyReply
  ) {
    try {
      const queryTargetIds = req.body.targetIds;
      const reviews = await reviewService.getReviewsByTargetIds(
        queryTargetIds || []
      );
      return reply.send(reviews);
    } catch (err: any) {
      return reply.status(400).send({ message: err.message });
    }
  },

  // Soft delete review
  //   async deleteReview(request: FastifyRequest<{ Params: { reviewId: string } }>, reply: FastifyReply) {
  //     try {
  //       const userId = (request.user as any).id;
  //       const { reviewId } = request.params;

  //       const result = await reviewService.deleteReview(parseInt(reviewId), userId);
  //       return reply.send(result);
  //     } catch (err: any) {
  //       return reply.status(400).send({ message: err.message });
  //     }
  //   }
};
