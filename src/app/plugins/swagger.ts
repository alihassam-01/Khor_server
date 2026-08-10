import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { CONFIG } from "@config/config";

const SWAGGER_ROUTE_PREFIX = "/details/api/swagger_2026_08_v1";

const tagForPath = (url: string): string => {
  const segment = url.replace(/^\/api\/?/, "").split("/")[0];
  if (!segment) return "System";
  if (segment === "admin") return "Admin";
  if (segment === "vendor") return "Vendor";
  if (segment === "partner") return "Partner";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
};

const descriptionForPath = (method: string, url: string): string => {
  const normalizedUrl = url.replace(/^\/api\/?/, "/");
  return `${method.toUpperCase()} ${normalizedUrl} endpoint for the Khor Travel Baltistan API.`;
};

const publicApiServerUrl = (): string => {
  const configuredUrl = CONFIG.api_domain.url?.replace(/\/+$/, "");
  if (configuredUrl) {
    return configuredUrl.endsWith("/api") ? configuredUrl : `${configuredUrl}/api`;
  }

  return `http://${CONFIG.server.host}:${CONFIG.server.port}/api`;
};

export default fp(async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Khor API",
        description: "Interactive API documentation for Khor Travel Baltistan. Use the Authorize button for JWT-protected endpoints.",
        version: "2026.08.1",
      },
      servers: [
        {
          url: publicApiServerUrl(),
          description: "Khor API",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: ({ schema, url, route }) => {
      const method = (Array.isArray(route.method) ? route.method.join(",") : route.method).toUpperCase();
      const routeSchema = schema ?? {};
      const tag = tagForPath(url);

      return {
        url,
        schema: {
          ...routeSchema,
          tags: routeSchema.tags ?? [tag],
          summary: routeSchema.summary ?? `${method} ${url}`,
          description: routeSchema.description ?? descriptionForPath(method, url),
        },
      };
    },
  });

  await fastify.register(fastifySwaggerUi, {
    routePrefix: SWAGGER_ROUTE_PREFIX,
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });
})
