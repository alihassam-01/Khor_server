import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { BookingAuditActorRole } from "@common/enums/booking.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";

@Entity("booking_audit_logs")
@Index("idx_booking_audit_logs_booking_created", ["booking_id", "created_at"])
@Index("idx_booking_audit_logs_event_type", ["event_type"])
export class BookingAuditLog {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, (booking) => booking.audit_logs, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "varchar", length: 100 })
    event_type!: string;

    @Column({ type: "uuid", nullable: true })
    actor_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "actor_user_id" })
    actor?: User | null;

    @Column({ type: "enum", enum: BookingAuditActorRole, default: BookingAuditActorRole.SYSTEM })
    actor_role!: BookingAuditActorRole;

    @Column({ type: "varchar", length: 50, nullable: true })
    source?: string | null;

    @Column({ type: "jsonb", nullable: true })
    before_state?: Record<string, unknown> | null;

    @Column({ type: "jsonb", nullable: true })
    after_state?: Record<string, unknown> | null;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, unknown> | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
