import { FastifyRequest, FastifyReply } from "fastify";
import { WhatsappToolsService } from "../service/whatsapp-tools.service";

export class WhatsappToolsController {
    private whatsappToolsService = new WhatsappToolsService();

    async searchRooms(
        req: FastifyRequest<{ Body: { location_id?: number; searchQuery?: string; guests?: number; limit?: number } }>,
        reply: FastifyReply
    ) {
        const query = req.body || {};
        const results = await this.whatsappToolsService.searchRooms(query);
        reply.send({ results });
    }

    async startAdminBooking(
        req: FastifyRequest<{ Body: { phone: string; bookingData: any } }>,
        reply: FastifyReply
    ) {
        const { phone, bookingData } = req.body;
        const result = await this.whatsappToolsService.startAdminBooking(phone, bookingData);
        reply.send(result);
    }

    async confirmAdminBooking(
        req: FastifyRequest<{ Body: { phone: string; otp: string; adminUserId: string } }>,
        reply: FastifyReply
    ) {
        const { phone, otp, adminUserId } = req.body;
        const result = await this.whatsappToolsService.confirmAdminBooking(phone, otp, adminUserId);
        reply.send(result);
    }

    async createCustomerBooking(
        req: FastifyRequest<{ Body: { bookingData: any; customerUserId?: string } }>,
        reply: FastifyReply
    ) {
        const { bookingData, customerUserId } = req.body;
        const result = await this.whatsappToolsService.createCustomerBooking(bookingData, customerUserId);
        reply.send(result);
    }
}
