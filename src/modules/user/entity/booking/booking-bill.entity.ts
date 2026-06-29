import {
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
import { User } from "@modules/user/entity/user/user.entity";
import { HotelBooking } from "./hotel-booking.entity";
import { BookingBillItem } from "./booking-bill-item.entity";
import { BookingBillPayment } from "./booking-bill-payment.entity";

@Entity("booking_bills")
@Index("uq_booking_bills_booking", ["booking_id"], { unique: true })
export class BookingBill {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    booking_id!: string;

    @OneToOne(() => HotelBooking, { onDelete: "CASCADE" })
    @JoinColumn({ name: "booking_id" })
    booking!: HotelBooking;

    @Column({ type: "varchar", length: 3, default: "PKR" })
    currency!: string;

    @Column({ type: "uuid", nullable: true })
    created_by_user_id?: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "created_by_user_id" })
    created_by?: User | null;

    @OneToMany(() => BookingBillItem, (item) => item.bill)
    items!: BookingBillItem[];

    @OneToMany(() => BookingBillPayment, (payment) => payment.bill)
    payments!: BookingBillPayment[];

    @CreateDateColumn({ type: "timestamptz" })
    created_at!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updated_at!: Date;
}
