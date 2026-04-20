import { AppDataSource } from "@config/ormconfig";
import { AuditLog } from "@modules/user/entity";
import { AuditLogStatus, AuditLogEventType } from "@modules/user/constant/audit.constant";
import { logError } from "@lib/logger";

export class AuditLogService {
    private auditLogRepository = AppDataSource.getRepository(AuditLog);

    async log(
        eventType: AuditLogEventType,
        recipient: string,
        status: AuditLogStatus,
        errorMessage?: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        try {
            const auditEntry = new AuditLog();
            auditEntry.event_type = eventType;
            auditEntry.recipient = recipient;
            auditEntry.status = status;
            auditEntry.error_message = errorMessage;
            auditEntry.metadata = metadata;

            await this.auditLogRepository.save(auditEntry);
        } catch (error) {
            logError(error as Error, `Failed to save audit log for ${eventType} to ${recipient}`);
        }
    }
}
