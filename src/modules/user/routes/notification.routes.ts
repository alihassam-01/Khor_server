import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { NotificationController } from "@modules/user/controller/notification.controller";

export async function notificationRoutes(fastify: FastifyInstance) {
    const controller = new NotificationController();

    fastify.get("/notifications/me", { preHandler: authenticate }, controller.listMine.bind(controller));
    fastify.post<{ Params: { id: string } }>(
        "/notifications/:id/read",
        { preHandler: authenticate },
        controller.markRead.bind(controller),
    );
    fastify.post("/notifications/read-all", { preHandler: authenticate }, controller.markAllRead.bind(controller));
    fastify.delete("/notifications/me", { preHandler: authenticate }, controller.clearMine.bind(controller));
}
