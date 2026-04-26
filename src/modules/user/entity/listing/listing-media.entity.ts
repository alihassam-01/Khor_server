import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { ListingMediaRole } from "@common/enums/listing.enums";
import { Listing } from "./listing.entity";
import { S3ImagesEntity } from "@modules/user/entity/images/s3Images.entity";

/**
 * Single source of truth for any image attached to a listing. Replaces the
 * legacy fields `hotel.image`, `hotel.logo`, `restaurant.image`,
 * `restaurant.menu_images[]`, and the unused polymorphic `media` table.
 *
 * Each row carries a role so the listing DTO can re-synthesize the legacy
 * field names (cover -> image, logo -> logo, gallery -> images,
 * menu -> menu_images) for frontend backward-compat.
 *
 * If the upload was performed by R2ClientService, `s3_image_id` links to the
 * row in `s3_images` so deletion can hard-delete the underlying object.
 */
@Entity("listing_media")
@Index(["listing_id", "role"])
export class ListingMedia {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, (listing) => listing.media, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "enum", enum: ListingMediaRole, default: ListingMediaRole.GALLERY })
    role!: ListingMediaRole;

    @Column({ type: "text" })
    url!: string;

    @Column({ type: "uuid", nullable: true })
    s3_image_id?: string | null;

    @ManyToOne(() => S3ImagesEntity, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "s3_image_id" })
    s3_image?: S3ImagesEntity | null;

    @Column({ type: "uuid", nullable: true })
    room_type_id?: string | null;

    @Column({ type: "int", default: 0 })
    display_order!: number;

    @Column({ type: "text", nullable: true })
    alt_text?: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
