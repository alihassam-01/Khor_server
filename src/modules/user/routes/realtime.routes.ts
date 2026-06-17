import { FastifyInstance, FastifyRequest } from "fastify";
import { UserRole } from "@common/enums/user.enums";
import { RATE_LIMITS } from "@config/rate-limit.config";
import { authenticate } from "@middlewares/authenticate";
import {
  realtimeTicketService,
  RealtimeTicketScope,
} from "@modules/user/service/realtime-ticket.service";

type RealtimeTicketBody = {
  scope?: RealtimeTicketScope;
};

const VALID_SCOPES = new Set<RealtimeTicketScope>(["booking", "support"]);

export async function realtimeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RealtimeTicketBody }>(
    "/realtime/tickets",
    {
      preHandler: authenticate,
      config: { rateLimit: RATE_LIMITS.realtimeTicket },
    },
    async (request: FastifyRequest<{ Body: RealtimeTicketBody }>, reply) => {
      const user = (request.user ?? {}) as {
        id?: string;
        userId?: string;
        userType?: UserRole;
      };
      const userId = user.id || user.userId;
      const scope = request.body?.scope;

      if (!userId || !user.userType) {
        return reply.code(401).send({ message: "Invalid authenticated user" });
      }
      if (!scope || !VALID_SCOPES.has(scope)) {
        return reply.code(400).send({ message: "scope must be booking or support" });
      }

      return reply.send(realtimeTicketService.issue(
        { userId, userType: user.userType },
        scope,
      ));
    },
  );
}
