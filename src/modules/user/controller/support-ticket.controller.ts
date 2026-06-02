import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { UserRole } from "@common/enums";
import {
    IAddSupportTicketMessageDTO,
    ICreateSupportTicketDTO,
    IEscalateSupportTicketDTO,
    IUpdateSupportTicketStatusDTO,
} from "@modules/user/dtos";
import { ISupportTicketIdParams } from "@modules/user/types";
import { FastifyReply, FastifyRequest } from "fastify";
import { SupportTicketService } from "@modules/user/service/support-ticket.service";

export class SupportTicketController {
    private readonly ticketService = new SupportTicketService();

    private getActor(req: FastifyRequest) {
        const userId = (req.user as any)?.id || (req.user as any)?.userId;
        const userType = (req.user as any)?.userType as UserRole | undefined;
        if (!userId || !userType) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }
        return { userId, userType };
    }

    async createCustomerTicket(
        req: FastifyRequest<{ Body: ICreateSupportTicketDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.code(201).send(await this.ticketService.createCustomerTicket(actor, req.body));
    }

    async listCustomerTickets(req: FastifyRequest, reply: FastifyReply) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.listCustomerTickets(actor.userId));
    }

    async getCustomerTicket(
        req: FastifyRequest<{ Params: ISupportTicketIdParams }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.getCustomerTicket(actor.userId, req.params.id));
    }

    async addCustomerMessage(
        req: FastifyRequest<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.addCustomerMessage(actor, req.params.id, req.body));
    }

    async listAdminTickets(req: FastifyRequest, reply: FastifyReply) {
        this.getActor(req);
        reply.send(await this.ticketService.listAdminTickets());
    }

    async getAdminTicket(
        req: FastifyRequest<{ Params: ISupportTicketIdParams }>,
        reply: FastifyReply,
    ) {
        this.getActor(req);
        reply.send(await this.ticketService.getAdminTicket(req.params.id));
    }

    async addAdminMessage(
        req: FastifyRequest<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.addAdminMessage(actor, req.params.id, req.body));
    }

    async updateAdminStatus(
        req: FastifyRequest<{ Params: ISupportTicketIdParams; Body: IUpdateSupportTicketStatusDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.updateAdminStatus(actor, req.params.id, req.body));
    }

    async escalateAdminTicket(
        req: FastifyRequest<{ Params: ISupportTicketIdParams; Body: IEscalateSupportTicketDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.escalateAdminTicket(actor, req.params.id, req.body));
    }

    async listVendorTickets(req: FastifyRequest, reply: FastifyReply) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.listVendorTickets(actor.userId));
    }

    async getVendorTicket(
        req: FastifyRequest<{ Params: ISupportTicketIdParams }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.getVendorTicket(actor.userId, req.params.id));
    }

    async addVendorMessage(
        req: FastifyRequest<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        reply.send(await this.ticketService.addVendorMessage(actor, req.params.id, req.body));
    }
}
