import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Hotel } from "./hotel.entity";
import { RoomType } from "@common/enums/property.enums";

@Entity("hotel_room_types")
export class HotelRoomType {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        type: "enum",
        enum: RoomType,
    })
    type!: RoomType;

    @Column("decimal", { precision: 10, scale: 2 })
    price!: number;

    @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
    amenities!: string[];

    @Column("int", { default: 1 })
    capacity!: number;

    @ManyToOne(() => Hotel, (hotel) => hotel.room_types, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "hotel_id" })
    hotel!: Hotel;

    @Column("varchar")
    hotel_id!: string;
}
