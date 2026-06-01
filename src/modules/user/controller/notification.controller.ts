import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "@common/enums/user.enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { NotificationService } from "@modules/user/service/notification.service";

type NotificationIdParams = { id: string };

export class NotificationController {
    private readonly notificationService = new NotificationService();

    private getActor(req: FastifyRequest) {
        const userId = (req.user as any)?.id || (req.user as any)?.userId;
        const userType = (req.user as any)?.userType as UserRole | undefined;
        if (!userId || !userType) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }
        return { userId, userType };
    }

    async listMine(req: FastifyRequest, reply: FastifyReply) {
        const actor = this.getActor(req);
        reply.send(await this.notificationService.listForActor(actor));
    }

    async markRead(
        req: FastifyRequest<{ Params: NotificationIdParams }>,
        reply: FastifyReply,
    ) {
        const actor = this.getActor(req);
        await this.notificationService.markRead(req.params.id, actor);
        reply.send({ success: true });
    }

    async markAllRead(req: FastifyRequest, reply: FastifyReply) {
        const actor = this.getActor(req);
        await this.notificationService.markAllRead(actor);
        reply.send({ success: true });
    }

    async clearMine(req: FastifyRequest, reply: FastifyReply) {
        const actor = this.getActor(req);
        await this.notificationService.clearAll(actor);
        reply.code(204).send();
    }
}
