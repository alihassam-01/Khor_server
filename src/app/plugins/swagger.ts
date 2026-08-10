import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { CONFIG } from "@config/config";

const SWAGGER_ROUTE_PREFIX = "/details/api/swagger_2026_08_v1";

type SwaggerDocument = {
  paths?: Record<string, Record<string, any>>;
};

const hotelExample = {
  id: "11111111-1111-1111-1111-111111111111",
  type: "hotel",
  name: "Mountain View Hotel",
  location: "Skardu",
  location_id: 2,
  price: 12000,
  image: "https://cdn.example.com/hotels/mountain-view.webp",
  images: ["https://cdn.example.com/hotels/mountain-view.webp"],
  rating: 4.5,
  reviews: 12,
  active: true,
  is_featured: false,
};

const restaurantExample = {
  id: "22222222-2222-2222-2222-222222222222",
  type: "restaurant",
  name: "Baltistan Kitchen",
  location: "Skardu",
  location_id: 2,
  price: 1500,
  image: "https://cdn.example.com/restaurants/baltistan-kitchen.webp",
  rating: 4.4,
  reviews: 18,
  active: true,
};

const locationExample = {
  id: 2,
  name: "Skardu",
  slug: "skardu",
  place_type: "city",
};

const operationDetails: Record<string, { summary: string; description: string; response: string }> = {
  "GET /hotels": {
    summary: "List public hotels",
    description: "Returns a paginated list of publicly visible hotels. Filter by location, minimum rating, maximum price, search text, or featured status.",
    response: "Returns items, total, page, and limit with hotel listing objects.",
  },
  "GET /hotels/:id": {
    summary: "Get a public hotel",
    description: "Returns one publicly visible hotel. The id path parameter must be a hotel UUID; location IDs are not valid here.",
    response: "Returns one hotel listing object.",
  },
  "GET /restaurants": {
    summary: "List public restaurants",
    description: "Returns a paginated list of publicly visible restaurants with search, location, rating, price, and featured filters.",
    response: "Returns items, total, page, and limit with restaurant listing objects.",
  },
  "GET /ads/hotel-restaurant": {
    summary: "Search hotels and restaurants",
    description: "Returns a combined paginated result for hotels and restaurants. Use type=hotel, type=restaurant, or type=all.",
    response: "Returns combined hotels, restaurants, and pagination data.",
  },
  "GET /ads/location/:location_id": {
    summary: "Get listings by location",
    description: "Returns hotel and restaurant ads for an integer location ID. Multiple IDs may be supplied as a comma-separated path value.",
    response: "Returns the combined hotel and restaurant listing payload for the requested locations.",
  },
  "GET /promoted-listings": {
    summary: "List promoted listings",
    description: "Returns promoted non-hotel listings with pagination and optional type, location, rating, price, and search filters.",
    response: "Returns promoted listing objects and pagination data.",
  },
  "POST /auth/login": {
    summary: "Log in",
    description: "Authenticates a user with email and password and creates an access/refresh session.",
    response: "Returns access and refresh session tokens plus the authenticated user.",
  },
  "GET /locations": {
    summary: "List locations",
    description: "Returns the available locations used by hotel, restaurant, article, and search filters.",
    response: "Returns an array of location objects.",
  },
  "GET /locations/:id": {
    summary: "Get a location",
    description: "Returns one location by its integer ID.",
    response: "Returns one location object.",
  },
  "GET /reviews/:targetType/:targetId": {
    summary: "List reviews for a target",
    description: "Returns reviews for a hotel, restaurant, or other reviewable target. Supports status, minimum rating, and pagination filters.",
    response: "Returns review objects and pagination data.",
  },
};

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
  const key = method.toUpperCase() + " " + normalizedUrl;
  const details = operationDetails[key];
  if (details) return details.description + " " + details.response;

  const upperMethod = method.toUpperCase();
  const action = upperMethod === "GET"
    ? "Retrieves"
    : upperMethod === "POST"
      ? "Creates or triggers"
      : upperMethod === "DELETE"
        ? "Deletes"
        : "Updates";
  const resource = normalizedUrl
    .replace(/[/:{}_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return action + " data for " + resource + ". Returns the JSON payload produced by the route handler; request and response examples below are illustrative where no explicit route schema is defined.";
};

const summaryForPath = (method: string, url: string): string => {
  const normalizedUrl = url.replace(/^\/api\/?/, "/");
  const details = operationDetails[method.toUpperCase() + " " + normalizedUrl];
  return details?.summary ?? method.toUpperCase() + " " + normalizedUrl;
};

const exampleForPath = (method: string, path: string): unknown => {
  if (path === "/hotels" || path === "/hotels/featured/{locationId}" || path === "/hotels/premium") {
    return { items: [hotelExample], total: 1, page: 1, limit: 10 };
  }
  if (path === "/hotels/{id}" || path.startsWith("/admin/hotels/") || path === "/vendor/hotels") {
    return hotelExample;
  }
  if (path === "/restaurants" || path.includes("/restaurants/featured/") || path.includes("/restaurants/premium/")) {
    return { items: [restaurantExample], total: 1, page: 1, limit: 10 };
  }
  if (path.includes("/restaurants/") || path === "/vendor/restaurants") {
    return restaurantExample;
  }
  if (path.startsWith("/locations")) {
    return path === "/locations" || path.endsWith("/children/{locationId}") ? [locationExample] : locationExample;
  }
  if (path.startsWith("/auth/login")) {
    return {
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example",
      refreshToken: "refresh-token-example",
      user: { id: "33333333-3333-3333-3333-333333333333", userType: "customer", isVerified: true },
    };
  }
  if (path.startsWith("/auth/")) return { message: "Authentication request completed." };
  if (path.startsWith("/reviews")) {
    return {
      items: [{ id: "44444444-4444-4444-4444-444444444444", rating: 5, reviewText: "Excellent stay." }],
      total: 1,
      page: 1,
      limit: 10,
    };
  }
  if (path.startsWith("/flights/")) {
    return { results: [], lowestPrice: null, highestPrice: null, averagePrice: null, currency: "PKR" };
  }
  if (path.endsWith("/events/stream") || path.endsWith("/stream")) {
    return "event stream example";
  }
  if (method.toUpperCase() === "DELETE") return { message: "Deleted successfully." };
  if (method.toUpperCase() === "GET") return { items: [], total: 0, page: 1, limit: 10 };
  return { message: "Request completed successfully." };
};

const responseDescriptionForPath = (method: string, path: string): string => {
  const normalizedUrl = path.replace(/\{([^}]+)\}/g, (value) => ":" + value.slice(1, -1));
  return operationDetails[method.toUpperCase() + " " + normalizedUrl]?.response
    ?? "Successful " + method.toUpperCase() + " response for " + normalizedUrl + ". The example is illustrative when the route has no explicit response schema.";
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
      const normalizedUrl = url.replace(/^\/api\/?/, "/");

      return {
        url,
        schema: {
          ...routeSchema,
          tags: routeSchema.tags ?? [tag],
          summary: routeSchema.summary ?? summaryForPath(method, normalizedUrl),
          description: routeSchema.description ?? descriptionForPath(method, url),
        },
      };
    },
    transformObject: (documentObject) => {
      const document = ("openapiObject" in documentObject
        ? documentObject.openapiObject
        : documentObject.swaggerObject) as SwaggerDocument;
      for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;

          const response = operation.responses?.["200"] ?? { description: "Successful response" };
          if (response.description === "Default Response") {
            response.description = responseDescriptionForPath(method, path);
          }
          const contentType = path.endsWith("/stream") ? "text/event-stream" : "application/json";
          response.content ??= {};
          response.content[contentType] ??= {};
          response.content[contentType].example ??= exampleForPath(method, path);
          operation.responses ??= {};
          operation.responses["200"] = response;
          operation.responses["400"] ??= { description: "Invalid request parameters or body." };
          operation.responses["401"] ??= { description: "Authentication is required or the credentials are invalid." };
          operation.responses["404"] ??= { description: "The requested resource was not found." };
        }
      }
      return document;
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
