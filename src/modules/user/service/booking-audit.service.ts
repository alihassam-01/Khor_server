import { EntityManager } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import { BookingAuditActorRole } from "@common/enums/booking.enums";
import { BookingAuditLog } from "@modules/user/entity/booking";

type RecordBookingAuditInput = {
    booking_id: string;
    event_type: string;
    actor_user_id?: string | null;
    actor_role?: BookingAuditActorRole;
    source?: string | null;
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
};

export class BookingAuditService {
    async record(
        input: RecordBookingAuditInput,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<BookingAuditLog> {
        const repo = manager.getRepository(BookingAuditLog);
        const auditLog = repo.create({
            booking_id: input.booking_id,
            event_type: input.event_type,
            actor_user_id: input.actor_user_id ?? null,
            actor_role: input.actor_role ?? BookingAuditActorRole.SYSTEM,
            source: input.source ?? null,
            before_state: input.before_state ?? null,
            after_state: input.after_state ?? null,
            metadata: input.metadata ?? null,
        });

        return repo.save(auditLog);
    }
}
