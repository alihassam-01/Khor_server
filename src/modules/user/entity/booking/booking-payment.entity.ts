import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { BookingPaymentStatus } from "@common/enums/booking.enums";
import { PaymentMethod } from "@common/enums/payment.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";
import { BookingRefund } from "./booking-refund.entity";

@Entity("booking_payments")
@Index("idx_booking_payments_booking_status", ["booking_id", "payment_status"])
export class BookingPayment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, (booking) => booking.payments, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "enum", enum: PaymentMethod, nullable: true })
    payment_method?: PaymentMethod | null;

    @Column({ type: "enum", enum: BookingPaymentStatus, default: BookingPaymentStatus.PENDING })
    payment_status!: BookingPaymentStatus;

    @Column({ type: "varchar", length: 3, default: "PKR" })
    currency!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    captured_amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    refunded_amount!: number;

    @Column({ type: "varchar", length: 100, nullable: true })
    provider?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    provider_payment_id?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    transaction_id?: string | null;

    @Column({ type: "text", nullable: true })
    receipt_url?: string | null;

    @Column({ type: "text", nullable: true })
    notes?: string | null;

    @Column({ type: "jsonb", nullable: true })
    metadata?: Record<string, unknown> | null;

    @Column({ type: "uuid", nullable: true })
    created_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by_user_id" })
    created_by?: User | null;

    @OneToMany(() => BookingRefund, (refund) => refund.payment)
    refunds!: BookingRefund[];

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
