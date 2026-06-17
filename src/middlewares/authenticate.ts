// authMiddleware.ts
import jwt from "jsonwebtoken";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { CONFIG } from "@config/config";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_PURPOSE,
} from "@modules/user/constant/auth-token.constant";

declare module "fastify" {
  interface FastifyRequest {
    user?: any;
  }
}
/**
 * Middleware to authenticate requests using JWT
 * @param request FastifyRequest
 * @param reply FastifyReply
 */
export const authenticate: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, CONFIG.jwt.secret as string, {
      algorithms: ["HS256"],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
    if (typeof decoded === "string" || decoded.purpose !== ACCESS_TOKEN_PURPOSE) {
      return reply.status(401).send({ message: "Invalid token" });
    }
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ message: "Invalid token" });
  }
}
