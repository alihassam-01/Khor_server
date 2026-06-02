import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { EntityManager } from "typeorm";
import { UserRole } from "@common/enums/user.enums";
import { UserNotification } from "@modules/user/entity/user";

export type NotificationActor = {
    userId: string;
    userType: UserRole;
};

export type NotificationPayload = {
    recipient_user_id: string;
    category: "booking" | "payment" | "hold" | "system" | "ticket";
    title: string;
    message: string;
    action: string;
    booking_id?: string | null;
    hold_id?: string | null;
    listing_id?: string | null;
    room_type_id?: string | null;
    metadata?: Record<string, unknown> | null;
};

export class NotificationService {
    private readonly repo = AppDataSource.getRepository(UserNotification);

    async createMany(
        notifications: NotificationPayload[],
        manager: EntityManager = AppDataSource.manager,
    ): Promise<void> {
        const deduped = notifications.filter((entry, index, all) => (
            all.findIndex((candidate) => (
                candidate.recipient_user_id === entry.recipient_user_id
                && candidate.action === entry.action
                && (candidate.booking_id ?? null) === (entry.booking_id ?? null)
                && (candidate.hold_id ?? null) === (entry.hold_id ?? null)
            )) === index
        ));

        if (deduped.length === 0) return;
        const repo = manager.getRepository(UserNotification);
        await repo.save(deduped.map((entry) => repo.create(entry)));
    }

    async listForActor(actor: NotificationActor): Promise<{
        items: Array<{
            id: string;
            category: string;
            title: string;
            message: string;
            action: string;
            booking_id?: string | null;
            hold_id?: string | null;
            listing_id?: string | null;
            room_type_id?: string | null;
            metadata?: Record<string, unknown> | null;
            read_at?: Date | null;
            created_at: Date;
        }>;
        unread_count: number;
    }> {
        const rows = await this.repo.find({
            where: { recipient_user_id: actor.userId },
            order: { created_at: "DESC" },
            take: 200,
        });

        return {
            items: rows.map((row) => ({
                id: row.id,
                category: row.category,
                title: row.title,
                message: row.message,
                action: row.action,
                booking_id: row.booking_id ?? null,
                hold_id: row.hold_id ?? null,
                listing_id: row.listing_id ?? null,
                room_type_id: row.room_type_id ?? null,
                metadata: row.metadata ?? null,
                read_at: row.read_at ?? null,
                created_at: row.created_at,
            })),
            unread_count: rows.filter((row) => !row.read_at).length,
        };
    }

    async markRead(notificationId: string, actor: NotificationActor): Promise<void> {
        const result = await this.repo.update(
            { id: notificationId, recipient_user_id: actor.userId },
            { read_at: new Date() },
        );
        if (!result.affected) {
            throw new AppError("Notification not found", 404, ErrorCodes.NOT_FOUND);
        }
    }

    async markAllRead(actor: NotificationActor): Promise<void> {
        await this.repo.createQueryBuilder()
            .update(UserNotification)
            .set({ read_at: new Date() })
            .where("recipient_user_id = :userId", { userId: actor.userId })
            .andWhere("read_at IS NULL")
            .execute();
    }

    async clearAll(actor: NotificationActor): Promise<void> {
        await this.repo.delete({ recipient_user_id: actor.userId });
    }
}
