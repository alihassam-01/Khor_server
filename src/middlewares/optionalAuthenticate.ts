import { CONFIG } from "@config/config";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_PURPOSE,
} from "@modules/user/constant/auth-token.constant";

export const optionalAuthenticate: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const authHeader = request.headers.authorization;
  if (!authHeader) return;

  if (!authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "Invalid authorization header" });
  }

  try {
    const decoded = jwt.verify(authHeader.slice("Bearer ".length), CONFIG.jwt.secret as string, {
      algorithms: ["HS256"],
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
    if (typeof decoded === "string" || decoded.purpose !== ACCESS_TOKEN_PURPOSE) {
      return reply.status(401).send({ message: "Invalid token" });
    }
    request.user = decoded;
  } catch {
    return reply.status(401).send({ message: "Invalid token" });
  }
};
