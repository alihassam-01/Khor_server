import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import {
    BookingRefundStatus,
    BookingRefundType,
} from "@common/enums/booking.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";
import { BookingPayment } from "./booking-payment.entity";

@Entity("booking_refunds")
@Index("idx_booking_refunds_booking_status", ["booking_id", "status"])
export class BookingRefund {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, (booking) => booking.refunds, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "uuid", nullable: true })
    payment_id?: string | null;

    @ManyToOne(() => BookingPayment, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "payment_id" })
    payment?: BookingPayment | null;

    @Column({ type: "enum", enum: BookingRefundType, default: BookingRefundType.FULL })
    refund_type!: BookingRefundType;

    @Column({ type: "text", nullable: true })
    reason?: string | null;

    @Column({ type: "uuid", nullable: true })
    requested_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "requested_by_user_id" })
    requested_by?: User | null;

    @Column({ type: "uuid", nullable: true })
    approved_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "approved_by_user_id" })
    approved_by?: User | null;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "enum", enum: BookingRefundStatus, default: BookingRefundStatus.REQUESTED })
    status!: BookingRefundStatus;

    @Column({ type: "varchar", length: 255, nullable: true })
    provider_refund_id?: string | null;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, unknown> | null;

    @Column({ type: "timestamptz", nullable: true })
    processed_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
