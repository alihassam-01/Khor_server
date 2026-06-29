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

@Entity("booking_bill_items")
@Index("idx_booking_bill_items_bill_created", ["bill_id", "created_at"])
@Index("idx_booking_bill_items_digest", ["daily_digest_sent_at"])
export class BookingBillItem {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    bill_id!: string;

    @ManyToOne(() => BookingBill, (bill) => bill.items, { onDelete: "CASCADE" })
    @JoinColumn({ name: "bill_id" })
    bill!: BookingBill;

    @Column({ type: "varchar", length: 160 })
    item_name!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "text", nullable: true })
    notes?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    daily_digest_sent_at?: Date | null;

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
