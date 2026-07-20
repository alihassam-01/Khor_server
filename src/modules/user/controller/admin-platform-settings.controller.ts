import { FastifyRequest, FastifyReply } from "fastify";
import { PlatformSettingsService } from "@modules/user/service/platform-settings.service";

export class AdminPlatformSettingsController {
    private platformSettingsService = new PlatformSettingsService();

    async getSettings(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const settings = await this.platformSettingsService.getAllSettings();
            reply.send(settings);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }

    async updateSettings(req: FastifyRequest, reply: FastifyReply) {
        try {
            const settings = req.body as Record<string, string>;
            if (!settings || typeof settings !== 'object') {
                reply.status(400).send({ message: "Invalid settings format. Expected an object." });
                return;
            }
            await this.platformSettingsService.updateSettings(settings);
            const updatedSettings = await this.platformSettingsService.getAllSettings();
            reply.send(updatedSettings);
        } catch (error: any) {
            reply.status(error.statusCode || 500).send({ message: error.message });
        }
    }
}
