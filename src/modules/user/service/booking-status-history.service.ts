import { EntityManager } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import { BookingStatusType } from "@common/enums/booking.enums";
import { BookingStatusHistory } from "@modules/user/entity/booking";

type RecordBookingStatusHistoryInput = {
    booking_id: string;
    status_type: BookingStatusType;
    from_status?: string | null;
    to_status: string;
    changed_by_user_id?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
};

export class BookingStatusHistoryService {
    async record(
        input: RecordBookingStatusHistoryInput,
        manager: EntityManager = AppDataSource.manager,
    ): Promise<BookingStatusHistory> {
        const repo = manager.getRepository(BookingStatusHistory);
        const statusHistory = repo.create({
            booking_id: input.booking_id,
            status_type: input.status_type,
            from_status: input.from_status ?? null,
            to_status: input.to_status,
            changed_by_user_id: input.changed_by_user_id ?? null,
            reason: input.reason ?? null,
            metadata: input.metadata ?? null,
        });

        return repo.save(statusHistory);
    }
}
