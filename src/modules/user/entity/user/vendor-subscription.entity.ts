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
import { User } from "./user.entity";
import { SubscriptionPlan } from "@modules/user/entity/subscription-plan.entity";
import { ListingSubscriptionStatus } from "@common/enums/listing.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";

/**
 * Canonical business-level subscription row for a vendor account.
 *
 * Product rule:
 * - one vendor email owns one hotel
 * - that hotel can have one associated restaurant
 * - both surfaces share the same billing lifecycle
 */
@Entity("vendor_subscriptions")
@Index(["vendor_id"], { unique: true })
@Index(["expires_at"])
export class VendorSubscription {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    vendor_id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "vendor_id" })
    vendor!: User;

    @Column({ type: "uuid", nullable: true })
    plan_id?: string | null;

    @ManyToOne(() => SubscriptionPlan, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "plan_id" })
    plan?: SubscriptionPlan | null;

    @Column({
        type: "enum",
        enum: SubscriptionType,
        enumName: "listing_subscriptions_subscription_type_enum",
        default: SubscriptionType.FREE,
    })
    subscription_type!: SubscriptionType;

    @Column({
        type: "enum",
        enum: ListingSubscriptionStatus,
        enumName: "listing_subscriptions_status_enum",
        default: ListingSubscriptionStatus.PENDING,
    })
    status!: ListingSubscriptionStatus;

    @Column({ type: "boolean", default: false })
    is_featured!: boolean;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    amount!: number;

    @Column({ type: "boolean", default: false })
    is_paid!: boolean;

    @Column({ type: "uuid", nullable: true })
    payment_id?: string | null;

    @Column({ type: "timestamptz", nullable: true })
    started_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    paid_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    next_due_date?: Date | null;

    @Column({ type: "int", default: 7 })
    grace_period_days!: number;

    @Column({ type: "timestamptz", nullable: true })
    expires_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
