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
import { RoomType } from "@common/enums/property.enums";
import { Listing } from "./listing.entity";

/**
 * One row per room category for a hotel listing (e.g. "Deluxe King",
 * "Standard Twin"). N:1 with Listing where `listing.type = HOTEL`.
 *
 * Switched the PK from int to uuid so it can be the `target_id` of a
 * polymorphic Review row without a type mismatch.
 */
@Entity("hotel_room_types")
@Index(["listing_id"])
export class HotelRoomType {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, (listing) => listing.room_types, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "varchar", length: 255 })
    name!: string;

    @Column({ type: "text", nullable: true })
    description?: string | null;

    @Column({ type: "enum", enum: RoomType, nullable: true })
    type?: RoomType | null;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    price!: number;

    @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
    amenities!: string[];

    @Column({ type: "int", default: 1 })
    capacity!: number;

    @Column({ type: "int", default: 1 })
    total_rooms!: number;

    @Column({ type: "varchar", length: 120, nullable: true })
    bed_details?: string | null;

    @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
    images!: string[];

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    size_sqm?: number | null;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
