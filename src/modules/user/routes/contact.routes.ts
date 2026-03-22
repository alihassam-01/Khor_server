import { FastifyInstance } from "fastify";
import { ContactController } from "@modules/user/controller/contact.controller";

export async function contactRoutes(fastify: FastifyInstance) {
    const contactController = new ContactController();

    fastify.post("/contact", contactController.sendMessage.bind(contactController));
}
