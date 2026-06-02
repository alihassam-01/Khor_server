import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
} from "typeorm";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";
import { HotelBooking } from "./hotel-booking.entity";

@Entity("hotel_booking_allocations")
@Index("idx_hotel_booking_allocations_listing_room_type", ["listing_id", "room_type_id"])
@Unique("uq_hotel_booking_allocations_booking_room_type", ["booking_id", "room_type_id"])
export class HotelBookingAllocation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @ManyToOne(() => HotelBooking, (booking) => booking.allocations, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "uuid" })
    room_type_id!: string;

    @ManyToOne(() => HotelRoomType, { nullable: false, onDelete: "RESTRICT" })
    @JoinColumn({ name: "room_type_id" })
    room_type!: HotelRoomType;

    @Column({ type: "int" })
    quantity_reserved!: number;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;
}
