import { FastifyInstance } from "fastify";
import { PaymentSettingController } from "../controller/payment-setting.controller";
import { ICreatePaymentSettingDTO, IUpdatePaymentSettingDTO } from "@modules/user/dtos";
import { IPaymentSettingIdParams } from "@modules/user/types";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";

export async function paymentSettingRoutes(fastify: FastifyInstance) {
    const controller = new PaymentSettingController();

    // Public/Vendor routes
    fastify.get(
        "/payment-settings/active",
        controller.getActiveSettings.bind(controller)
    );
    fastify.get(
        "/payment-settings/payout-commission",
        controller.getPayoutCommissionSetting.bind(controller)
    );

    // Admin routes
    fastify.post<{ Body: ICreatePaymentSettingDTO }>(
        "/admin/payment-settings",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.createSetting.bind(controller)
    );
    fastify.get(
        "/admin/payment-settings",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.getAllSettings.bind(controller)
    );
    fastify.patch<{ Params: IPaymentSettingIdParams; Body: IUpdatePaymentSettingDTO }>(
        "/admin/payment-settings/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.updateSetting.bind(controller)
    );
    fastify.put<{ Body: IUpdatePaymentSettingDTO & { rate: number } }>(
        "/admin/payment-settings/payout-commission",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.updatePayoutCommissionSetting.bind(controller)
    );
    fastify.delete<{ Params: IPaymentSettingIdParams }>(
        "/admin/payment-settings/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        controller.deleteSetting.bind(controller)
    );
}
