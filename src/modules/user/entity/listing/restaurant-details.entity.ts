import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
} from "typeorm";
import { Listing } from "./listing.entity";

/**
 * Restaurant-specific extension of a Listing. 1:1 with `Listing` where
 * `listing.type = RESTAURANT`.
 */
@Entity("restaurant_details")
export class RestaurantDetails {
    @PrimaryColumn("uuid")
    listing_id!: string;

    @OneToOne(() => Listing, (listing) => listing.restaurant_details, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
    cuisines!: string[];

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    price_per_person?: number | null;

    /**
     * Free-form opening hours payload. Shape is agreed with the frontend; we
     * keep it in jsonb to avoid yet another table for what is effectively
     * a small object per listing.
     */
    @Column({ type: "jsonb", nullable: true })
    opening_hours?: Record<string, unknown> | null;
}
