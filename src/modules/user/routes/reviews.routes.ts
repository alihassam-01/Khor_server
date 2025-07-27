import { FastifyInstance } from "fastify";
import { ReviewController } from "@modules/user/controller";
// import { ReviewStatus } from "../entity/ENUM/enum";

export async function reviewRoutes(fastify: FastifyInstance) {
  fastify.post("/reviews", ReviewController.createReview);
  //   fastify.get("/reviews/user", ReviewController.getUserReviews);
  fastify.get(
    "/reviews/:targetType/:targetId",
    ReviewController.getReviewsForTarget
  );
  fastify.patch(
    "/reviews/:reviewId/status",
    ReviewController.updateReviewStatus
  );
  fastify.patch("/reviews/:reviewId/helpful", ReviewController.markHelpful);
//   fastify.get("/reviews/target-ids",  ReviewController.getReviewsByTargetIds); // Query params
  fastify.post("/reviews/target-ids",  ReviewController.getReviewsByTargetIds); // Body
  //   fastify.delete("/reviews/:reviewId", ReviewController.deleteReview);
}
