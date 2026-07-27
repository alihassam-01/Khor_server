import { FastifyInstance } from "fastify";
import { WhatsappToolsController } from "../controller/whatsapp-tools.controller";

/**
 * These routes act as Tools for the OpenClaw Agent.
 * Authentication should be enforced if the gateway is running externally, 
 * but for the MVP, assuming the Gateway runs alongside and calls these endpoints securely.
 */
export async function whatsappToolsRoutes(fastify: FastifyInstance) {
    const whatsappToolsController = new WhatsappToolsController();

    fastify.post(
        "/whatsapp-tools/search-rooms",
        whatsappToolsController.searchRooms.bind(whatsappToolsController)
    );

    fastify.post(
        "/whatsapp-tools/start-admin-booking",
        whatsappToolsController.startAdminBooking.bind(whatsappToolsController)
    );

    fastify.post(
        "/whatsapp-tools/confirm-admin-booking",
        whatsappToolsController.confirmAdminBooking.bind(whatsappToolsController)
    );

    fastify.post(
        "/whatsapp-tools/create-customer-booking",
        whatsappToolsController.createCustomerBooking.bind(whatsappToolsController)
    );
}

export default whatsappToolsRoutes;
