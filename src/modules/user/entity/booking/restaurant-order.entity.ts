import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { HotelBooking } from "./hotel-booking.entity";
import { Listing } from "../listing/listing.entity";
import { User } from "../user/user.entity";
import { BookingBillItem } from "./booking-bill-item.entity";

@Entity("restaurant_orders")
@Index("idx_restaurant_orders_booking", ["booking_id"])
@Index("idx_restaurant_orders_restaurant", ["restaurant_id"])
@Index("idx_restaurant_orders_vendor", ["vendor_id"])
@Index("idx_restaurant_orders_status", ["status"])
export class RestaurantOrder {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    restaurant_id!: string;

    @ManyToOne(() => Listing, { onDelete: "CASCADE" })
    @JoinColumn({ name: "restaurant_id" })
    restaurant!: Listing;

    @Column({ type: "uuid" })
    vendor_id!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "vendor_id" })
    vendor!: User;

    @Column({ type: "uuid", nullable: true })
    booking_id?: string | null;

    @ManyToOne(() => HotelBooking, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "booking_id" })
    booking?: HotelBooking | null;

    @Column({ type: "uuid", nullable: true })
    guest_user_id?: string | null;

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "guest_user_id" })
    guest?: User | null;

    @Column({ type: "varchar", length: 50 })
    source!: "online" | "manual";

    @Column({ type: "varchar", length: 50, default: "pending" })
    status!: "pending" | "confirmed" | "cooking" | "served" | "cancelled";

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    paid_amount!: number;

    @Column({ type: "varchar", length: 50, default: "unpaid" })
    payment_status!: "unpaid" | "partial" | "paid";

    @Column({ type: "varchar", length: 255, nullable: true })
    customer_name?: string | null;

    @Column({ type: "varchar", length: 50, nullable: true })
    customer_phone?: string | null;

    @Column({ type: "text", nullable: true })
    notes?: string | null;

    @Column({ type: "jsonb" })
    items!: any;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    total_amount!: number;

    @Column({ type: "timestamptz", nullable: true })
    requested_for?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    confirmed_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    served_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    cancelled_at?: Date | null;

    @Column({ type: "uuid", nullable: true })
    created_by_vendor_user_id?: string | null;

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by_vendor_user_id" })
    created_by_vendor?: User | null;

    @Column({ type: "uuid", nullable: true })
    created_by_guest_user_id?: string | null;

    @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
    @JoinColumn({ name: "created_by_guest_user_id" })
    created_by_guest?: User | null;

    @Column({ type: "uuid", nullable: true, unique: true })
    booking_bill_item_id?: string | null;

    @OneToOne(() => BookingBillItem, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "booking_bill_item_id" })
    booking_bill_item?: BookingBillItem | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
