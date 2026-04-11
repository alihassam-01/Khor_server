import { FastifyRequest, FastifyReply } from "fastify";
import { PaymentSettingService } from "@modules/user/service/payment-setting.service";
import { 
    ICreatePaymentSettingDTO, 
    IUpdatePaymentSettingDTO, 
    IPaymentSettingDTO 
} from "@modules/user/dtos";
import { logError } from "@lib/logger";
import { IPaymentSettingIdParams } from "@modules/user/types";

export class PaymentSettingController {
    private settingService = new PaymentSettingService();

    async createSetting(
        request: FastifyRequest<{ Body: ICreatePaymentSettingDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const data = request.body;
            const setting: IPaymentSettingDTO = await this.settingService.createSetting(data);
            return reply.status(201).send(setting);
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, "Create Payment Setting");
            return reply.status(400).send({ message: err.message });
        }
    }

    async updateSetting(
        request: FastifyRequest<{ Params: IPaymentSettingIdParams; Body: IUpdatePaymentSettingDTO }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            const data = request.body;
            const setting: IPaymentSettingDTO = await this.settingService.updateSetting(id, data);
            return reply.send(setting);
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, "Update Payment Setting");
            return reply.status(400).send({ message: err.message });
        }
    }

    async getAllSettings(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const settings: IPaymentSettingDTO[] = await this.settingService.getAllSettings();
            return reply.send(settings);
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, "Get All Payment Settings");
            return reply.status(500).send({ message: err.message });
        }
    }

    async getActiveSettings(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const settings: IPaymentSettingDTO[] = await this.settingService.getActiveSettings();
            return reply.send(settings);
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, "Get Active Payment Settings");
            return reply.status(500).send({ message: err.message });
        }
    }

    async deleteSetting(
        request: FastifyRequest<{ Params: IPaymentSettingIdParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { id } = request.params;
            await this.settingService.deleteSetting(id);
            return reply.status(204).send();
        } catch (error: unknown) {
            const err = error as Error;
            logError(err, "Delete Payment Setting");
            return reply.status(400).send({ message: err.message });
        }
    }
}
