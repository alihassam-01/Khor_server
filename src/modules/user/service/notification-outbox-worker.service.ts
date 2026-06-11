import { CONFIG } from "@config/config";
import { AppDataSource } from "@config/ormconfig";
import { NotificationOutboxStatus } from "@common/enums/notification.enums";
import { NotificationOutbox } from "@modules/user/entity/user";
import { logError, logInfo } from "@lib/logger";
import { renderWhatsAppMessage } from "./whatsapp-message.service";
import { AuditLogService } from "./audit-log.service";
import { AuditLogEventType, AuditLogStatus } from "../constant/audit.constant";
import {
    WhatsAppAdapterError,
    WhatsAppAdapterService,
} from "./whatsapp-adapter.service";

export class NotificationOutboxWorkerService {
    private readonly adapter = new WhatsAppAdapterService();
    private readonly auditLogService = new AuditLogService();

    private getRetryDate(attemptCount: number): Date {
        const delaySeconds = Math.min(30 * (2 ** Math.max(attemptCount - 1, 0)), 15 * 60);
        const jitterMs = Math.floor(Math.random() * 5_000);
        return new Date(Date.now() + delaySeconds * 1000 + jitterMs);
    }

    private async claimBatch(): Promise<NotificationOutbox[]> {
        return AppDataSource.transaction(async (manager) => {
            await manager.createQueryBuilder()
                .update(NotificationOutbox)
                .set({
                    status: NotificationOutboxStatus.RETRY,
                    locked_at: null,
                    next_attempt_at: new Date(),
                    last_error: "Recovered after worker lock timeout",
                })
                .where("status = :status", { status: NotificationOutboxStatus.PROCESSING })
                .andWhere("locked_at < NOW() - INTERVAL '10 minutes'")
                .execute();

            const rows = await manager.getRepository(NotificationOutbox)
                .createQueryBuilder("outbox")
                .where("outbox.status IN (:...statuses)", {
                    statuses: [
                        NotificationOutboxStatus.PENDING,
                        NotificationOutboxStatus.RETRY,
                    ],
                })
                .andWhere("outbox.next_attempt_at <= NOW()")
                .orderBy("outbox.created_at", "ASC")
                .setLock("pessimistic_write")
                .setOnLocked("skip_locked")
                .take(CONFIG.notifications.workerBatchSize)
                .getMany();

            if (rows.length === 0) return [];
            const claimedAt = new Date();
            for (const row of rows) {
                row.status = NotificationOutboxStatus.PROCESSING;
                row.locked_at = claimedAt;
                row.attempt_count += 1;
            }
            return manager.getRepository(NotificationOutbox).save(rows);
        });
    }

    private async processRow(row: NotificationOutbox): Promise<void> {
        const repo = AppDataSource.getRepository(NotificationOutbox);
        const auditMetadata = {
            outboxId: row.id,
            eventType: row.event_type,
            templateKey: row.template_key,
            recipientType: row.recipient_type,
            bookingId: row.booking_id ?? null,
            listingId: row.listing_id ?? null,
            attemptCount: row.attempt_count,
        };
        try {
            const message = renderWhatsAppMessage(
                row.template_key,
                row.payload as Record<string, unknown>,
            );
            const result = await this.adapter.send({
                idempotencyKey: row.id,
                number: row.destination,
                message,
            });
            await repo.update(row.id, {
                status: NotificationOutboxStatus.SENT,
                provider_message_id: result.providerMessageId ?? null,
                sent_at: new Date(),
                locked_at: null,
                last_error: null,
            });
            await this.auditLogService.log(
                AuditLogEventType.WHATSAPP_NOTIFICATION,
                row.destination,
                AuditLogStatus.SUCCESS,
                undefined,
                auditMetadata,
            );
        } catch (error) {
            const adapterError = error instanceof WhatsAppAdapterError ? error : null;
            const exhausted = row.attempt_count >= CONFIG.notifications.workerMaxAttempts;
            const status = adapterError?.outcomeUnknown
                ? NotificationOutboxStatus.UNKNOWN
                : adapterError?.retryable && !exhausted
                    ? NotificationOutboxStatus.RETRY
                    : NotificationOutboxStatus.FAILED;
            await repo.update(row.id, {
                status,
                next_attempt_at: status === NotificationOutboxStatus.RETRY
                    ? this.getRetryDate(row.attempt_count)
                    : row.next_attempt_at,
                locked_at: null,
                last_error: error instanceof Error ? error.message.slice(0, 2000) : "Unknown delivery error",
            });
            await this.auditLogService.log(
                AuditLogEventType.WHATSAPP_NOTIFICATION,
                row.destination,
                AuditLogStatus.FAILED,
                error instanceof Error ? error.message.slice(0, 2000) : "Unknown delivery error",
                {
                    ...auditMetadata,
                    outboxStatus: status,
                },
            );
            logError(error, `WhatsApp outbox delivery ${row.id}`);
        }
    }

    async processDue(): Promise<void> {
        if (!CONFIG.notifications.whatsappEnabled) return;
        const rows = await this.claimBatch();
        if (rows.length === 0) return;
        await Promise.allSettled(rows.map((row) => this.processRow(row)));
        logInfo("WhatsApp notification batch processed.", { count: rows.length });
    }
}
