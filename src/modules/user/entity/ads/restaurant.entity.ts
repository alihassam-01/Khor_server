import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm";
import { Location } from "../location";
import { User } from "../user";
import { SubscriptionType } from "../ENUM/ad-payment.enum";

@Entity("restaurants")
export class Restaurant {
    @PrimaryGeneratedColumn()
    id!: string;

    @Column("varchar", { length: 255 })
    name!: string;

    @Column("text")
    location_name!: string;

    @Column("decimal", { precision: 10, scale: 2 })
    price!: number;

    @Column("decimal", { precision: 2, scale: 1, default: 0 })
    rating!: number;

    @Column("int", { default: 0 })
    reviews!: number;

    @Column("text")
    image!: string;

    @Column("varchar", { length: 50, nullable: true })
    phone!: string | null;

    @Column("varchar", { length: 50, nullable: true })
    whatsapp!: string | null;

    @Column("varchar", { length: 255, nullable: true })
    facebook!: string | null;

    @Column("varchar", { length: 255, nullable: true })
    instagram!: string | null;

    @Column("varchar", { length: 255, nullable: true })
    website!: string | null;

    @Column("text")
    description!: string;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    menu_images!: string[];

    @Column("boolean", { default: true })
    is_active!: boolean;

    @Column("uuid", { nullable: true })
    vendor_id?: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "vendor_id" })
    vendor?: User;

    @Column("timestamp", { nullable: true })
    expires_at?: Date;

    @Column({
        type: "enum",
        enum: SubscriptionType,
        default: SubscriptionType.FREE,
    })
    subscription_type!: SubscriptionType;

    @Column("boolean", { default: false })
    is_paid!: boolean;

    @Column("boolean", { default: false })
    is_featured!: boolean;

    @ManyToOne(() => Location, { nullable: false })
    @JoinColumn({ name: "location_id" })
    location!: Location;

    @Column("int")
    location_id!: number;

    @OneToMany("RestaurantReview", "restaurant", {
        cascade: true,
    })
    detailed_reviews!: any[];

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at!: Date;
}
