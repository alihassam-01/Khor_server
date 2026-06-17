import { UserRole } from "@common/enums";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

type AuthUser = {
  id?: string;
  userId?: string;
  userType?: UserRole;
};

type UserIdParams = {
  id?: string;
};

export const authorizeSelfOrAdmin: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const user = (request.user ?? {}) as AuthUser;
  const authenticatedUserId = user.userId || user.id;
  const requestedUserId = (request.params as UserIdParams | undefined)?.id;

  if (!authenticatedUserId) {
    return reply.status(401).send({ message: "Not authenticated" });
  }

  if (user.userType === UserRole.ADMIN || authenticatedUserId === requestedUserId) {
    return;
  }

  return reply.status(403).send({
    message: "Forbidden: You can only access your own profile.",
  });
};
