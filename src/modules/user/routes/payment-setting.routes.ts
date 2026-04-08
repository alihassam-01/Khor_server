import { FastifyInstance } from "fastify";
import { PaymentSettingController } from "../controller/payment-setting.controller";

export async function paymentSettingRoutes(fastify: FastifyInstance) {
    const controller = new PaymentSettingController();

    // Public/Vendor routes
    fastify.get(
        "/payment-settings/active",
        controller.getActiveSettings.bind(controller)
    );

    // Admin routes
    fastify.post(
        "/admin/payment-settings",
        controller.createSetting.bind(controller)
    );
    fastify.get(
        "/admin/payment-settings",
        controller.getAllSettings.bind(controller)
    );
    fastify.patch(
        "/admin/payment-settings/:id",
        controller.updateSetting.bind(controller)
    );
    fastify.delete(
        "/admin/payment-settings/:id",
        controller.deleteSetting.bind(controller)
    );
}
