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
import { BookingHoldStatus } from "@common/enums/booking.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";

@Entity("booking_room_holds")
@Index("idx_booking_room_holds_customer_status", ["customer_user_id", "status"])
@Index("idx_booking_room_holds_room_dates_status", [
    "room_type_id",
    "check_in_date",
    "check_out_date",
    "status",
])
@Index("idx_booking_room_holds_expires_status", ["expires_at", "status"])
export class BookingRoomHold {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    customer_user_id!: string;

    @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "customer_user_id" })
    customer!: User;

    @Column({ type: "uuid" })
    listing_id!: string;

    @ManyToOne(() => Listing, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "listing_id" })
    listing!: Listing;

    @Column({ type: "uuid" })
    room_type_id!: string;

    @ManyToOne(() => HotelRoomType, { nullable: false, onDelete: "CASCADE" })
    @JoinColumn({ name: "room_type_id" })
    room_type!: HotelRoomType;

    @Column({ type: "int" })
    rooms_count!: number;

    @Column({ type: "int" })
    guest_count!: number;

    @Column({ type: "date" })
    check_in_date!: string;

    @Column({ type: "date" })
    check_out_date!: string;

    @Column({ type: "enum", enum: BookingHoldStatus, default: BookingHoldStatus.ACTIVE })
    status!: BookingHoldStatus;

    @Column({ type: "timestamptz" })
    expires_at!: Date;

    @Column({ type: "timestamptz", nullable: true })
    released_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    consumed_at?: Date | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
