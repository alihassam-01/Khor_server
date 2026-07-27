import { FastifyRequest, FastifyReply } from "fastify";
import { WhatsappInboundService } from "../service/whatsapp-inbound.service";
import { WhatsAppAdapterService } from "../service/whatsapp-adapter.service";
import { logInfo, logError } from "@lib/logger";
import { randomUUID } from "crypto";

export class WhatsappInboundController {
    private inboundService = new WhatsappInboundService();
    private adapterService = new WhatsAppAdapterService();

    handleWebhook = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = req.body as any;
            
            // Handle different variations of webhook payload from OpenClaw
            let sender = body?.data?.number || body?.number || body?.sender;
            let text = body?.data?.text || body?.data?.message || body?.text || body?.message;

            if (!sender || !text) {
                // If it's not a message event, just return 200 OK
                return reply.code(200).send({ status: "ignored", reason: "no sender or text" });
            }

            const responseMessage = await this.inboundService.handleInboundMessage(sender, text);

            if (responseMessage) {
                // Send reply back via the existing adapter
                await this.adapterService.send({
                    idempotencyKey: randomUUID(),
                    number: sender,
                    message: responseMessage
                });
                logInfo(`Replied to WhatsApp inbound from ${sender}`);
            }

            return reply.code(200).send({ status: "success" });
        } catch (error: any) {
            logError(error, "Error handling WhatsApp inbound webhook");
            return reply.code(500).send({ status: "error", message: error.message });
        }
    }
}
