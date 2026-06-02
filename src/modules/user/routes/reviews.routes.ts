import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { ReviewController } from "@modules/user/controller/review.controller";

export async function reviewRoutes(fastify: FastifyInstance) {
    const reviewController = new ReviewController();

    fastify.get<{
        Params: { targetType: string; targetId: string };
    }>(
        "/reviews/eligibility/:targetType/:targetId",
        { preHandler: authenticate },
        async (req, reply) => reviewController.eligibility(req, reply),
    );

    fastify.get<{
        Params: { targetType: string; targetId: string };
        Querystring: { status?: string; minRating?: string; page?: string; limit?: string };
    }>(
        "/reviews/:targetType/:targetId",
        async (req, reply) => reviewController.listByTarget(req, reply),
    );

    fastify.post<{
        Body: {
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
    }>(
        "/reviews",
        { preHandler: authenticate },
        async (req, reply) => reviewController.create(req, reply),
    );

    fastify.post<{
        Body: { targetIds: string[] };
    }>(
        "/reviews/target-ids",
        async (req, reply) => reviewController.bulkByTargetIds(req, reply),
    );

    fastify.patch<{
        Params: { id: string };
        Body: { helpful: boolean };
    }>(
        "/reviews/:id/helpful",
        { preHandler: authenticate },
        async (req, reply) => reviewController.markHelpful(req, reply),
    );
}
