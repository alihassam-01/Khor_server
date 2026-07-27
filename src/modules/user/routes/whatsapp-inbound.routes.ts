import { FastifyInstance } from "fastify";
import { WhatsappInboundController } from "../controller/whatsapp-inbound.controller";

export default async function whatsappInboundRoutes(fastify: FastifyInstance) {
    const controller = new WhatsappInboundController();

    // Hook from OpenClaw
    fastify.post("/whatsapp-inbound/message", controller.handleWebhook);
}
