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

@Entity("hotel_promotions")
@Index(["listing_id"])
@Index(["is_active", "start_date", "end_date"])
export class HotelPromotion {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, (listing) => listing.promotions, { onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "varchar", length: 160 })
    name!: string;

    @Column({ type: "varchar", length: 20 })
    discount_type!: "percentage" | "fixed";

    @Column({ type: "decimal", precision: 10, scale: 2 })
    discount_value!: number;

    @Column({ type: "varchar", length: 50, default: "all" })
    applies_to!: string;

    @Column({ type: "date" })
    start_date!: string;

    @Column({ type: "date" })
    end_date!: string;

    @Column({ type: "boolean", default: true })
    is_active!: boolean;

    @Column({ type: "int", default: 0 })
    usage_count!: number;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
