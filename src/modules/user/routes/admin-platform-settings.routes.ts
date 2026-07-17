import { FastifyInstance } from "fastify";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { AdminPlatformSettingsController } from "@modules/user/controller/admin-platform-settings.controller";

export async function adminPlatformSettingsRoutes(fastify: FastifyInstance) {
    const controller = new AdminPlatformSettingsController();

    // Use admin authentication middleware
    fastify.addHook("preHandler", authenticate);
    fastify.addHook("preHandler", authorizeAdmin);

    fastify.get(
        "/admin/platform-settings",
        {
            schema: {
                tags: ["Admin Platform Settings"],
                description: "Get all platform settings",
                response: {
                    200: {
                        type: "object",
                        additionalProperties: { type: "string" }
                    }
                }
            }
        },
        controller.getSettings.bind(controller)
    );

    fastify.put(
        "/admin/platform-settings",
        {
            schema: {
                tags: ["Admin Platform Settings"],
                description: "Update platform settings",
                body: {
                    type: "object",
                    additionalProperties: { type: "string" }
                },
                response: {
                    200: {
                        type: "object",
                        additionalProperties: { type: "string" }
                    }
                }
            }
        },
        controller.updateSettings.bind(controller)
    );
}
