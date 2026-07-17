import {
    BeforeInsert,
    BeforeUpdate,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { ListingStatus, ListingType } from "@common/enums/listing.enums";
import { Location } from "@modules/user/entity/location";
import { User } from "@modules/user/entity/user/user.entity";
import { ListingContact } from "./listing-contact.entity";
import { ListingMedia } from "./listing-media.entity";

import { HotelDetails } from "./hotel-details.entity";
import { RestaurantDetails } from "./restaurant-details.entity";
import { HotelRoomType } from "./hotel-room-type.entity";
import { HotelPromotion } from "./hotel-promotion.entity";

/**
 * Core polymorphic listing row. All hotels, restaurants, tours, and vehicles
 * live in this single table. Type-specific fields hang off of the
 * 1:1 extension entities (HotelDetails, RestaurantDetails, ...).
 *
 * Cached aggregates `rating_avg` and `rating_count` are maintained by the
 * Review service inside the same transaction as a review CRUD operation.
 *
 * `is_active` is a denormalized boolean form of `status === ACTIVE`, kept for
 * cheap WHERE clauses on hot list endpoints.
 */
@Entity("listings")
@Index(["type", "status", "location_id"])
@Index(["vendor_id"])
@Index(["is_featured", "status", "location_id"])
export class Listing {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "enum", enum: ListingType })
    type!: ListingType;

    @Column({ type: "varchar", length: 160, nullable: true, unique: true })
    slug?: string | null;

    @Column({ type: "varchar", length: 255 })
    name!: string;

    @Column({ type: "text", default: "" })
    description!: string;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    price_from!: number;

    @Column({ type: "enum", enum: ListingStatus, default: ListingStatus.PENDING })
    status!: ListingStatus;

    @Column({ type: "boolean", default: false })
    is_active!: boolean;

    @Column({ type: "boolean", default: true })
    is_public_visible!: boolean;

    @Column({ type: "text", nullable: true })
    visibility_note!: string | null;

    @Column({ type: "boolean", default: false })
    is_featured!: boolean;

    @Column({ type: "boolean", default: false })
    is_verified!: boolean;

    @Column({ type: "decimal", precision: 3, scale: 2, default: 0 })
    rating_avg!: number;

    @Column({ type: "int", default: 0 })
    rating_count!: number;

    @Column({ type: "int", default: 0 })
    view_count!: number;

    @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
    latitude!: number | null;

    @Column({ type: "decimal", precision: 10, scale: 7, nullable: true })
    longitude!: number | null;

    @Column({ type: "text", array: true, default: () => "ARRAY[]::text[]" })
    amenities!: string[];

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "vendor_id" })
    vendor?: User | null;

    @Column({ type: "uuid", nullable: true })
    vendor_id?: string | null;

    @ManyToOne(() => Location, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "location_id" })
    location!: Location;

    @Column({ type: "int" })
    location_id!: number;

    /**
     * Concatenated, lower-cased, search-friendly text. Maintained automatically
     * by the BeforeInsert/BeforeUpdate hook below. The migration creates a
     * GIN index on the tsvector form of this column for fast ILIKE-free search.
     */
    @Column({ type: "text", default: "", select: false })
    fulltext_index!: string;

    @Column({ type: "tsvector", nullable: true, select: false })
    search_vector!: string | null;

    @OneToOne(() => ListingContact, (contact) => contact.listing, { cascade: true })
    contact?: ListingContact;

    @OneToOne(() => HotelDetails, (h) => h.listing, { cascade: true })
    hotel_details?: HotelDetails;

    @OneToOne(() => RestaurantDetails, (r) => r.listing, { cascade: true })
    restaurant_details?: RestaurantDetails;

    @OneToMany(() => ListingMedia, (media) => media.listing, { cascade: true })
    media!: ListingMedia[];

    @OneToMany(() => HotelRoomType, (rt) => rt.listing, { cascade: true })
    room_types!: HotelRoomType[];

    @OneToMany(() => HotelPromotion, (promotion) => promotion.listing, { cascade: true })
    promotions!: HotelPromotion[];


    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;

    @DeleteDateColumn({ type: "timestamptz", nullable: true })
    deleted_at?: Date | null;

    @BeforeInsert()
    @BeforeUpdate()
    setFulltextIndex(): void {
        const parts = [this.name, this.description, ...(this.amenities || [])];
        this.fulltext_index = parts.filter(Boolean).join(" ").toLowerCase();
    }
}
