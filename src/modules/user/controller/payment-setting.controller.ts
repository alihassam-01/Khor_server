import { FastifyRequest, FastifyReply } from "fastify";
import { PaymentSettingService } from "../service/payment-setting.service";
import { ICreatePaymentSettingDTO, IUpdatePaymentSettingDTO } from "../dtos/payment-setting.dto";
import { logError } from "@lib/logger";

export class PaymentSettingController {
    private settingService = new PaymentSettingService();

    async createSetting(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = request.body as ICreatePaymentSettingDTO;
            const setting = await this.settingService.createSetting(data);
            return reply.status(201).send(setting);
        } catch (error: any) {
            logError(error, "Create Payment Setting");
            return reply.status(400).send({ message: error.message });
        }
    }

    async updateSetting(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string };
            const data = request.body as IUpdatePaymentSettingDTO;
            const setting = await this.settingService.updateSetting(id, data);
            return reply.send(setting);
        } catch (error: any) {
            logError(error, "Update Payment Setting");
            return reply.status(400).send({ message: error.message });
        }
    }

    async getAllSettings(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const settings = await this.settingService.getAllSettings();
            return reply.send(settings);
        } catch (error: any) {
            logError(error, "Get All Payment Settings");
            return reply.status(500).send({ message: error.message });
        }
    }

    async getActiveSettings(_request: FastifyRequest, reply: FastifyReply) {
        try {
            const settings = await this.settingService.getActiveSettings();
            return reply.send(settings);
        } catch (error: any) {
            logError(error, "Get Active Payment Settings");
            return reply.status(500).send({ message: error.message });
        }
    }

    async deleteSetting(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string };
            await this.settingService.deleteSetting(id);
            return reply.status(204).send();
        } catch (error: any) {
            logError(error, "Delete Payment Setting");
            return reply.status(400).send({ message: error.message });
        }
    }
}
