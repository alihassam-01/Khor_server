import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import {
    NotificationChannel,
    NotificationOutboxStatus,
} from "@common/enums/notification.enums";

@Entity("notification_outbox")
@Index("uq_notification_outbox_event_key", ["event_key"], { unique: true })
@Index("idx_notification_outbox_due", ["status", "next_attempt_at"])
@Index("idx_notification_outbox_booking", ["booking_id"])
export class NotificationOutbox {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 255 })
    event_key!: string;

    @Column({
        type: "enum",
        enum: NotificationChannel,
        enumName: "notification_channel",
    })
    channel!: NotificationChannel;

    @Column({ type: "varchar", length: 120 })
    event_type!: string;

    @Column({ type: "varchar", length: 30 })
    recipient_type!: string;

    @Column({ type: "uuid", nullable: true })
    recipient_user_id?: string | null;

    @Column({ type: "uuid", nullable: true })
    booking_id?: string | null;

    @Column({ type: "uuid", nullable: true })
    listing_id?: string | null;

    @Column({ type: "varchar", length: 50 })
    destination!: string;

    @Column({ type: "varchar", length: 120 })
    template_key!: string;

    @Column({ type: "jsonb" })
    payload!: object;

    @Column({
        type: "enum",
        enum: NotificationOutboxStatus,
        enumName: "notification_outbox_status",
        default: NotificationOutboxStatus.PENDING,
    })
    status!: NotificationOutboxStatus;

    @Column({ type: "int", default: 0 })
    attempt_count!: number;

    @Column({ type: "timestamptz", default: () => "now()" })
    next_attempt_at!: Date;

    @Column({ type: "timestamptz", nullable: true })
    locked_at?: Date | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    provider_message_id?: string | null;

    @Column({ type: "text", nullable: true })
    last_error?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    sent_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
