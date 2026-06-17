import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import fastifyHelmet from "@fastify/helmet";
import { CONFIG } from "@config/config";

export default fp(async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: CONFIG.env === "production"
      ? {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
        },
      }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: CONFIG.env === "production"
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: "no-referrer" },
  });

  fastify.addHook("onSend", async (_request, reply) => {
    reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    );
  });
});
