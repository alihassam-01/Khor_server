import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { UserType } from "@modules/user/entity/ENUM/enum";

/**
 * Middleware to strictly authorize requests for ADMIN users
 * This must be executed AFTER the `authenticate` middleware.
 * @param request FastifyRequest
 * @param reply FastifyReply
 */
export const authorizeAdmin: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Ensure the user exists (set by authenticate middleware)
  if (!request.user) {
    return reply.status(401).send({ message: "Not authenticated" });
  }

  // Ensure they have the ADMIN role
  if (request.user.userType !== UserType.ADMIN) {
    return reply.status(403).send({ 
       message: "Forbidden: You do not have administrator permissions to perform this action." 
    });
  }
};
