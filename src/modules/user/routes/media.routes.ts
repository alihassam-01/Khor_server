import { FastifyInstance } from "fastify";
import { MediaController } from "@modules/user/controller/media.controller";
import { authenticate } from "@middlewares/authenticate";

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
        { preHandler: authenticate },
        mediaController.uploadImages.bind(mediaController)
    );
};
