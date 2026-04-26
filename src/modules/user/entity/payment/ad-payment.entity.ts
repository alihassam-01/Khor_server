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
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingSubscription } from "@modules/user/entity/listing/listing-subscription.entity";
import { PaymentMethod, PaymentStatus } from "@common/enums/payment.enums";

/**
 * Payment intent / receipt for an ad. Now references a Listing directly
 * (instead of carrying both `ad_id` and `ad_type` as strings) and optionally
 * links to the specific `ListingSubscription` period it paid for.
 *
 * The DTO layer continues to expose `ad_id` / `ad_type` for backward-compat
 * with the existing API surface; on the database level we use proper FKs.
 */
@Entity("ad_payments")
@Index(["listing_id"])
@Index(["vendor_id"])
@Index(["payment_status"])
export class AdPayment {
    @PrimaryGeneratedColumn("uuid")
    payment_id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "uuid", nullable: true })
    subscription_id?: string | null;

    @ManyToOne(() => ListingSubscription, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "subscription_id" })
    subscription?: ListingSubscription | null;

    @Column({ type: "uuid" })
    vendor_id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "vendor_id" })
    vendor!: User;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "enum", enum: PaymentStatus, default: PaymentStatus.PENDING })
    payment_status!: PaymentStatus;

    @Column({ type: "enum", enum: PaymentMethod, nullable: true })
    payment_method?: PaymentMethod;

    @Column({ type: "varchar", length: 255, nullable: true })
    transaction_id?: string;

    @Column({ type: "text", nullable: true })
    notes?: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    receipt_url?: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
