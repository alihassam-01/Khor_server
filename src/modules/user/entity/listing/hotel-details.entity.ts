import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
} from "typeorm";
import { Listing } from "./listing.entity";

/**
 * Hotel-specific extension of a Listing. 1:1 with `Listing` where
 * `listing.type = HOTEL`. Holds fields that only make sense for hotels;
 * absent for any other listing type.
 */
@Entity("hotel_details")
export class HotelDetails {
    @PrimaryColumn("uuid")
    listing_id!: string;

    @OneToOne(() => Listing, (listing) => listing.hotel_details, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    /**
     * Star rating (0..5). Distinct from the user-review-derived `rating_avg`
     * on Listing — this is the "official" hotel category, set by admin.
     */
    @Column({ type: "smallint", nullable: true })
    star_rating?: number | null;

    @Column({ type: "varchar", length: 8, nullable: true })
    check_in_time?: string | null;

    @Column({ type: "varchar", length: 8, nullable: true })
    check_out_time?: string | null;

    @Column({ type: "text", nullable: true })
    cancellation_policy?: string | null;
}
