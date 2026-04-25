import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { AnalyticsEventType } from "@common/enums/analytics.enums";
import { ListingType } from "@common/enums/listing.enums";

/**
 * One row per analytics event (view/click) on a listing. References a Listing
 * via FK now; `listing_type` is denormalized for fast type-grouped reports.
 */
@Entity("ad_analytics")
@Index(["listing_id", "event_type", "created_at"])
@Index(["listing_type", "event_type", "created_at"])
export class AdAnalytics {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "enum", enum: ListingType })
    listing_type!: ListingType;

    @Column({ type: "enum", enum: AnalyticsEventType })
    event_type!: AnalyticsEventType;

    @Column({ type: "varchar", length: 255, nullable: true })
    ip_hash?: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
