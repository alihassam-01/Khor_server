import { FastifyRequest, FastifyReply } from "fastify";
import { SendEmail } from "@modules/user/service/email/sendEmail";

export class ContactController {
    private sendEmailService: SendEmail;

    constructor() {
        this.sendEmailService = new SendEmail();
    }

    async sendMessage(
        req: FastifyRequest<{
            Body: {
                name: string;
                email: string;
                subject: string;
                message: string;
            };
        }>,
        reply: FastifyReply
    ) {
        try {
            const { name, email, subject, message } = req.body;

            if (!name || !email || !subject || !message) {
                return reply.code(400).send({ message: "All fields are required" });
            }

            await this.sendEmailService.sendContactEmail(
                name,
                email,
                subject,
                message
            );

            reply.send({ message: "Message sent successfully" });
        } catch (error: any) {
            console.error("Contact form error:", error);
            reply.code(500).send({ message: "Failed to send message" });
        }
    }
}
