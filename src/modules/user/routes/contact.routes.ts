import { FastifyInstance } from "fastify";
import { ContactController } from "@modules/user/controller/contact.controller";
import { RATE_LIMITS } from "@config/rate-limit.config";

export async function contactRoutes(fastify: FastifyInstance) {
    const contactController = new ContactController();

    fastify.post(
        "/contact",
        { config: { rateLimit: RATE_LIMITS.contact } },
        contactController.sendMessage.bind(contactController),
    );
}
