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
import { VendorSubscription } from "@modules/user/entity/user/vendor-subscription.entity";

@Entity("vendor_subscription_payments")
@Index("idx_vendor_sub_payments_vendor", ["vendor_id"])
@Index("idx_vendor_sub_payments_period", ["period_year", "period_month"])
export class VendorSubscriptionPayment {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    vendor_id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "vendor_id" })
    vendor!: User;

    @Column({ type: "uuid" })
    subscription_id!: string;

    @ManyToOne(() => VendorSubscription, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "subscription_id" })
    subscription!: VendorSubscription;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 20, default: "pending" })
    status!: "pending" | "paid" | "waived";

    @Column({ type: "int" })
    period_month!: number; // 1-12

    @Column({ type: "int" })
    period_year!: number;

    @Column({ type: "timestamptz", nullable: true })
    payment_date?: Date | null;

    @Column({ type: "text", nullable: true })
    notes?: string | null;

    @Column({ type: "uuid", nullable: true })
    recorded_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "recorded_by_user_id" })
    recorded_by?: User | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
