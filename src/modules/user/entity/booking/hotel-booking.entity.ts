import { randomBytes } from "crypto";
import {
    BeforeInsert,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import {
    BookingCancellationStatus,
    BookingPaymentStatus,
    BookingRefundStatus,
    BookingSource,
    HotelBookingStatus,
} from "@common/enums/booking.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing/hotel-room-type.entity";
import { HotelBookingAllocation } from "./hotel-booking-allocation.entity";
import { BookingPayment } from "./booking-payment.entity";
import { BookingRefund } from "./booking-refund.entity";
import { BookingAuditLog } from "./booking-audit-log.entity";
import { BookingStatusHistory } from "./booking-status-history.entity";
import { BookingBill } from "./booking-bill.entity";

@Entity("hotel_bookings")
@Index("idx_hotel_bookings_customer", ["customer_user_id"])
@Index("idx_hotel_bookings_listing_dates", ["listing_id", "check_in_date", "check_out_date"])
@Index("idx_hotel_bookings_room_type_dates_status", [
    "room_type_id",
    "check_in_date",
    "check_out_date",
    "booking_status",
])
@Index("idx_hotel_bookings_source_status_created", ["source", "booking_status", "created_at"])
export class HotelBooking {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 40, unique: true })
    booking_number!: string;

    @Column({ type: "enum", enum: BookingSource, default: BookingSource.CUSTOMER_WEB })
    source!: BookingSource;

    @Column({ type: "uuid", nullable: true })
    customer_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "customer_user_id" })
    customer?: User | null;

    @Column({ type: "varchar", length: 160 })
    guest_name!: string;

    @Column({ type: "varchar", length: 255 })
    guest_email!: string;

    @Column({ type: "varchar", length: 50 })
    guest_phone!: string;

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
    rooms_count!: number;

    @Column({ type: "int" })
    guest_count!: number;

    @Column({ type: "date" })
    check_in_date!: string;

    @Column({ type: "date" })
    check_out_date!: string;

    @Column({ type: "int" })
    nights!: number;

    @Column({ type: "varchar", length: 3, default: "PKR" })
    currency!: string;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    nightly_rate_snapshot!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    subtotal_amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    discount_amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    tax_amount!: number;

    @Column({ type: "decimal", precision: 10, scale: 2 })
    total_amount!: number;

    @Column({ type: "enum", enum: HotelBookingStatus, default: HotelBookingStatus.PENDING })
    booking_status!: HotelBookingStatus;

    @Column({ type: "enum", enum: BookingPaymentStatus, default: BookingPaymentStatus.PENDING })
    payment_status!: BookingPaymentStatus;

    @Column({
        type: "enum",
        enum: BookingCancellationStatus,
        default: BookingCancellationStatus.NOT_REQUESTED,
    })
    cancellation_status!: BookingCancellationStatus;

    @Column({ type: "enum", enum: BookingRefundStatus, default: BookingRefundStatus.NONE })
    refund_status!: BookingRefundStatus;

    @Column({ type: "text", nullable: true })
    cancellation_policy_snapshot?: string | null;

    @Column({ type: "int", nullable: true })
    refund_cutoff_hours_snapshot?: number | null;

    @Column({ type: "text", nullable: true })
    special_requests?: string | null;

    @Column({ type: "uuid", nullable: true })
    created_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by_user_id" })
    created_by?: User | null;

    @Column({ type: "uuid", nullable: true })
    confirmed_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "confirmed_by_user_id" })
    confirmed_by?: User | null;

    @Column({ type: "uuid", nullable: true })
    cancelled_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "cancelled_by_user_id" })
    cancelled_by?: User | null;

    @Column({ type: "uuid", nullable: true })
    completed_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "completed_by_user_id" })
    completed_by?: User | null;

    @Column({ type: "timestamptz", nullable: true })
    confirmed_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    cancelled_at?: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    completed_at?: Date | null;

    @OneToMany(() => HotelBookingAllocation, (allocation) => allocation.booking)
    allocations!: HotelBookingAllocation[];

    @OneToMany(() => BookingPayment, (payment) => payment.booking)
    payments!: BookingPayment[];

    @OneToMany(() => BookingRefund, (refund) => refund.booking)
    refunds!: BookingRefund[];

    @OneToMany(() => BookingAuditLog, (auditLog) => auditLog.booking)
    audit_logs!: BookingAuditLog[];

    @OneToMany(() => BookingStatusHistory, (statusHistory) => statusHistory.booking)
    status_history!: BookingStatusHistory[];

    @OneToOne(() => BookingBill, (bill) => bill.booking)
    bill?: BookingBill | null;

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;

    @BeforeInsert()
    assignBookingNumber(): void {
        if (!this.booking_number) {
            const seed = randomBytes(3).toString("hex").toUpperCase();
            this.booking_number = `KHB-${Date.now().toString(36).toUpperCase()}-${seed}`;
        }
    }
}
