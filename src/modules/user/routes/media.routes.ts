import { FastifyInstance } from "fastify";
import { MediaController } from "@modules/user/controller/media.controller";
import { authenticate } from "@middlewares/authenticate";
import { RATE_LIMITS } from "@config/rate-limit.config";
import { CONFIG } from "@config/config";

export const mediaRoutes = async (fastify: FastifyInstance) => {
    const mediaController = new MediaController();

    /**
     * POST /api/media/upload
     * Accepts multipart/form-data
     * Fields: 
     *  - images: File | File[]
     *  - type: string (optional, folder name)
     */
    fastify.post(
        "/media/upload",
        {
            preHandler: authenticate,
            bodyLimit: CONFIG.server.multipartBodyLimit,
            config: { rateLimit: RATE_LIMITS.upload },
        },
        mediaController.uploadImages.bind(mediaController)
    );
    fastify.get(
        "/media/library",
        {
            preHandler: authenticate,
        },
        mediaController.getLibrary.bind(mediaController)
    );
};
