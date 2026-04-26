import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryColumn,
} from "typeorm";
import { Listing } from "./listing.entity";

/**
 * Contact and external links for a listing. 1:1 with Listing — split out from
 * the parent table because (a) most callers don't need these columns and (b)
 * keeping listings narrow keeps hot indexes/queries small.
 */
@Entity("listing_contacts")
export class ListingContact {
    @PrimaryColumn("uuid")
    listing_id!: string;

    @OneToOne(() => Listing, (listing) => listing.contact, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "varchar", length: 50, nullable: true })
    phone!: string | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    whatsapp!: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    facebook!: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    instagram!: string | null;

    @Column({ type: "varchar", length: 255, nullable: true })
    website!: string | null;

    @Column({ type: "text", nullable: true })
    map_link!: string | null;

    /**
     * Free-form address line, used when callers don't have a structured
     * Address row to point at.
     */
    @Column({ type: "text", nullable: true })
    address!: string | null;
}
