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
import { Listing } from "./listing.entity";
import { SubscriptionPlan } from "@modules/user/entity/subscription-plan.entity";
import { ListingSubscriptionStatus } from "@common/enums/listing.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";

/**
 * A single subscription period for a listing. Replaces the
 * promotional fields that used to live on `hotels`/`restaurants`
 * (subscription_type, plan_id, expires_at, is_paid, is_featured).
 *
 * Each renewal creates a new row, preserving history. The "current" period
 * for a listing is the most recent row whose status is `ACTIVE` (or
 * `PENDING` while awaiting payment approval).
 */
@Entity("listing_subscriptions")
@Index(["listing_id", "status"])
@Index(["expires_at"])
export class ListingSubscription {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, (listing) => listing.subscriptions, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "uuid", nullable: true })
    plan_id?: string | null;

    @ManyToOne(() => SubscriptionPlan, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "plan_id" })
    plan?: SubscriptionPlan | null;

    /**
     * Cached snapshot of the plan's type at the time this period was created.
     * Lets us read the "current tier" without joining the plan table.
     */
    @Column({ type: "enum", enum: SubscriptionType, default: SubscriptionType.FREE })
    subscription_type!: SubscriptionType;

    @Column({ type: "enum", enum: ListingSubscriptionStatus, default: ListingSubscriptionStatus.PENDING })
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
