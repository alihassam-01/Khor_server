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
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";

@Entity("booking_payouts")
@Index("idx_booking_payouts_vendor_status", ["vendor_id", "status"])
@Index("idx_booking_payouts_booking_unique", ["booking_id"], { unique: true })
export class BookingPayout {
    @PrimaryGeneratedColumn("uuid")
    payout_id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "uuid", nullable: true })
    vendor_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "vendor_id" })
    vendor?: User | null;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    gross_amount?: number | null;

    @Column({ type: "decimal", precision: 8, scale: 6, nullable: true })
    commission_rate?: number | null;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    commission_amount?: number | null;

    @Column({ type: "varchar", length: 20, default: "pending" })
    status!: "pending" | "completed" | "failed";

    @Column({ type: "timestamptz", nullable: true })
    payout_date?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
