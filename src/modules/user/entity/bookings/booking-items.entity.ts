import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Property } from "@entity/property";
import { Booking } from "./booking.entity";
import { BookingItemOption } from "./booking-item-options.entity";

// BookingItems entity represents the items associated with a booking, such as properties booked, their quantities, prices, and dates.
// this shows whether a room or car or tour_operator is booked a booking may have multiple booking items

@Entity()
export class BookingItems {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Booking, (booking) => booking.items, { onDelete: "CASCADE" })
  booking!: Booking;

  @ManyToOne(() => Property, { onDelete: "CASCADE" })
  property!: Property;

  @Column({ type: "int", nullable: false })
  quantity!: number;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  price!: number;

  @Column({ type: "timestamp", nullable: false })
  checkin_date!: Date;

  @Column({ type: "timestamp", nullable: false })
  checkout_date!: Date;

  @Column({ type: "timestamp", nullable: false })
  booking_date!: Date;

  @Column({ type: "varchar", length: 50, nullable: false })
  status!: string;

  @OneToMany(() => BookingItemOption, (option) => option.bookingItem, {
    cascade: true,
  })
  options!: BookingItemOption[];
}
