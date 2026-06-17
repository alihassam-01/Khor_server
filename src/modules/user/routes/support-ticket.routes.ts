import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { RATE_LIMITS } from "@config/rate-limit.config";
import { UserRole } from "@common/enums";
import { SupportTicketController } from "@modules/user/controller/support-ticket.controller";
import {
    IAddSupportTicketMessageDTO,
    ICreateSupportTicketDTO,
    IEscalateSupportTicketDTO,
    IUpdateSupportTicketStatusDTO,
} from "@modules/user/dtos";
import { ISupportTicketIdParams } from "@modules/user/types";
import {
    ticketRealtimeService,
    TicketRealtimeEvent,
} from "@modules/user/service/ticket-realtime.service";
import { realtimeTicketService } from "@modules/user/service/realtime-ticket.service";

type StreamAuthQuery = { ticket?: string };

const beginSse = (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin ?? "*";
    reply.hijack();
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
    });
    reply.raw.write("retry: 10000\n\n");
};

const writeSseEvent = (reply: FastifyReply, event: TicketRealtimeEvent) => {
    reply.raw.write("event: ticket-event\n");
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
};

export async function supportTicketRoutes(fastify: FastifyInstance) {
    const controller = new SupportTicketController();

    fastify.post<{ Body: ICreateSupportTicketDTO }>(
        "/support/tickets",
        { preHandler: authenticate },
        controller.createCustomerTicket.bind(controller),
    );
    fastify.get("/support/tickets/me", { preHandler: authenticate }, controller.listCustomerTickets.bind(controller));
    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/support/tickets/stream",
        { config: { rateLimit: RATE_LIMITS.realtimeConnect } },
        async (request, reply) => {
            const actor = realtimeTicketService.consume(request.query.ticket, "support", UserRole.CUSTOMER);
            if (!actor) {
                reply.code(401).send({ message: "Invalid realtime ticket" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = ticketRealtimeService.subscribe({
                id: `customer-ticket:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "customer",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );
    fastify.get<{ Params: ISupportTicketIdParams }>(
        "/support/tickets/:id",
        { preHandler: authenticate },
        controller.getCustomerTicket.bind(controller),
    );
    fastify.post<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>(
        "/support/tickets/:id/messages",
        { preHandler: authenticate },
        controller.addCustomerMessage.bind(controller),
    );

    fastify.get(
        "/admin/support/tickets",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.listAdminTickets.bind(controller),
    );
    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/admin/support/tickets/stream",
        { config: { rateLimit: RATE_LIMITS.realtimeConnect } },
        async (request, reply) => {
            const actor = realtimeTicketService.consume(request.query.ticket, "support", UserRole.ADMIN);
            if (!actor) {
                reply.code(401).send({ message: "Invalid realtime ticket" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = ticketRealtimeService.subscribe({
                id: `admin-ticket:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "admin",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );
    fastify.get<{ Params: ISupportTicketIdParams }>(
        "/admin/support/tickets/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.getAdminTicket.bind(controller),
    );
    fastify.post<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>(
        "/admin/support/tickets/:id/messages",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.addAdminMessage.bind(controller),
    );
    fastify.patch<{ Params: ISupportTicketIdParams; Body: IUpdateSupportTicketStatusDTO }>(
        "/admin/support/tickets/:id/status",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.updateAdminStatus.bind(controller),
    );
    fastify.patch<{ Params: ISupportTicketIdParams; Body: IEscalateSupportTicketDTO }>(
        "/admin/support/tickets/:id/escalate",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.escalateAdminTicket.bind(controller),
    );

    fastify.get("/vendor/support/tickets", { preHandler: authenticate }, controller.listVendorTickets.bind(controller));
    fastify.get<{ Querystring: StreamAuthQuery }>(
        "/vendor/support/tickets/stream",
        { config: { rateLimit: RATE_LIMITS.realtimeConnect } },
        async (request, reply) => {
            const actor = realtimeTicketService.consume(request.query.ticket, "support", UserRole.VENDOR);
            if (!actor) {
                reply.code(401).send({ message: "Invalid realtime ticket" });
                return;
            }

            beginSse(request, reply);
            const heartbeat = setInterval(() => {
                reply.raw.write(": ping\n\n");
            }, 30000);

            const unsubscribe = ticketRealtimeService.subscribe({
                id: `vendor-ticket:${actor.userId}:${Date.now()}:${Math.random()}`,
                scope: "vendor",
                userId: actor.userId,
                send: (event) => writeSseEvent(reply, event),
            });

            request.raw.on("close", () => {
                clearInterval(heartbeat);
                unsubscribe();
            });
        },
    );
    fastify.get<{ Params: ISupportTicketIdParams }>(
        "/vendor/support/tickets/:id",
        { preHandler: authenticate },
        controller.getVendorTicket.bind(controller),
    );
    fastify.post<{ Params: ISupportTicketIdParams; Body: IAddSupportTicketMessageDTO }>(
        "/vendor/support/tickets/:id/messages",
        { preHandler: authenticate },
        controller.addVendorMessage.bind(controller),
    );
}
