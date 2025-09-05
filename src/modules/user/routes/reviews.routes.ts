import { FastifyInstance } from "fastify";
import { ReviewController } from "../../user/controller";
import { CreateReviewDTO } from "../dtos/reviews.dto";
import { authenticate } from "../../../middlewares/authenticate";
// import { ReviewStatus } from "../entity/ENUM/enum";

export async function reviewRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateReviewDTO }>(
    "/reviews",
    { preHandler: authenticate },
    ReviewController.createReview
  );
  //   fastify.get("/reviews/user", ReviewController.getUserReviews);
  fastify.get(
    "/reviews/:targetType/:targetId",
    ReviewController.getReviewsForTarget
  );
  fastify.patch(
    "/reviews/:reviewId/status",
    ReviewController.updateReviewStatus
  );
  fastify.patch<{ Params: { reviewId: string }; Body: { helpful: boolean } }>(
    "/reviews/:reviewId/helpful",
    { preHandler: authenticate },
    ReviewController.markHelpful
  );
  //   fastify.get("/reviews/target-ids",  ReviewController.getReviewsByTargetIds); // Query params
  fastify.post("/reviews/target-ids", ReviewController.getReviewsByTargetIds); // Body
  //   fastify.delete("/reviews/:reviewId", ReviewController.deleteReview);
}
