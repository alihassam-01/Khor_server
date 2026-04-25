import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { Hotel } from "./hotel.entity";
import { RoomType } from "@common/enums/property.enums";

@Entity("hotel_room_types")
export class HotelRoomType {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar", { length: 255 })
    name!: string;

    @Column("text", { nullable: true })
    description!: string;

    @Column({
        type: "enum",
        enum: RoomType,
        nullable: true,
    })
    type!: RoomType;

    @Column("decimal", { precision: 10, scale: 2 })
    price!: number;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    amenities!: string[];

    @Column("int", { default: 1 })
    capacity!: number;

    @Column("int", { default: 1 })
    total_rooms!: number;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    images!: string[];

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    size_sqm!: number;

    @Column("boolean", { default: true })
    is_active!: boolean;

    @ManyToOne(() => Hotel, (hotel) => hotel.room_types, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "hotel_id" })
    hotel!: Hotel;

    @Column("varchar")
    hotel_id!: string;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
