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

@Entity("hotels")
export class Hotel {
    @PrimaryGeneratedColumn()
    id!: string;

    @Column("varchar", { length: 255 })
    name!: string;

    @Column("decimal", { precision: 2, scale: 1, default: 0 })
    rating!: number;

    @Column("int", { default: 0 })
    reviews!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    price!: number;

    @Column("text")
    location_name!: string;

    @Column("text")
    image!: string;

    @Column("text")
    description!: string;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    amenities!: string[];

    @Column("text", { nullable: true })
    logo!: string | null;

    @Column("boolean", { default: false })
    verified!: boolean;

    @Column("varchar", { length: 50, nullable: true })
    phone!: string | null;

    @Column("varchar", { length: 50, nullable: true })
    whatsapp!: string | null;

    @Column("boolean", { default: true })
    is_active!: boolean;

    @ManyToOne(() => Location, { nullable: false })
    @JoinColumn({ name: "location_id" })
    location!: Location;

    @Column("int")
    location_id!: number;

    @OneToMany("HotelReview", "hotel", { cascade: true })
    detailed_reviews!: any[];

    @OneToMany("HotelRoomType", "hotel", { cascade: true })
    room_types!: any[];

    @CreateDateColumn({ type: "timestamp" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updated_at!: Date;
}
