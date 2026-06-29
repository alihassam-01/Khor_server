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
import { BookingBill } from "./booking-bill.entity";

@Entity("booking_bill_payments")
@Index("idx_booking_bill_payments_bill_created", ["bill_id", "created_at"])
export class BookingBillPayment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    bill_id!: string;

    @ManyToOne(() => BookingBill, (bill) => bill.payments, { onDelete: "CASCADE" })
    @JoinColumn({ name: "bill_id" })
    bill!: BookingBill;

    @Column({ type: "varchar", length: 3, default: "PKR" })
    currency!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 50, nullable: true })
    payment_method?: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    transaction_id?: string | null;

    @Column({ type: "text", nullable: true })
    notes?: string | null;

    @Column({ type: "uuid", nullable: true })
    created_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by_user_id" })
    created_by?: User | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
