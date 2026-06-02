import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { BookingStatusType } from "@common/enums/booking.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";

@Entity("booking_status_history")
@Index("idx_booking_status_history_booking_type_created", ["booking_id", "status_type", "created_at"])
export class BookingStatusHistory {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, (booking) => booking.status_history, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "enum", enum: BookingStatusType })
    status_type!: BookingStatusType;

    @Column({ type: "varchar", length: 50, nullable: true })
    from_status?: string | null;

    @Column({ type: "varchar", length: 50 })
    to_status!: string;

    @Column({ type: "uuid", nullable: true })
    changed_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "changed_by_user_id" })
    changed_by?: User | null;

    @Column({ type: "text", nullable: true })
    reason?: string | null;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, unknown> | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
