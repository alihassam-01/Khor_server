// import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne } from "typeorm";
// import { BookingItems } from "./booking-items.entity";
// import { Transactions } from "./transactions.entity";
// // import { RoomType } from "../room";

// @Entity()
// export class Booking {
//   @PrimaryGeneratedColumn()
//   id!: number;

//   @Column({ type: "int", nullable: false })
//   customerId!: number;

//   @Column({ type: "varchar", length: 50, nullable: false })
//   status!: string;

//   @Column({ type: "timestamp", nullable: false })
//   bookingDate!: Date;

//   @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
//   totalAmount!: number;

//   @OneToMany(() => BookingItems, item => item.booking)
//   items!: BookingItems[];

//   // room type
//   // @OneToOne(() => RoomType, roomType => roomType.booking)
//   // roomType!: RoomType;

//   @OneToOne(() => Transactions, transaction => transaction.booking)
//   transaction!: Transactions;
// }
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
  Index,
} from "typeorm";
import { Property } from "../property";
import { RoomType } from "../room";
import { Vehicle } from "../property/vehicle.entity";
import { TourPackage } from "../property/tour-package.entity";

@Entity("bookings")
@Check(`"payment_status" IN ('pending', 'paid', 'refunded')`)
@Check(`"booking_status" IN ('pending', 'confirmed', 'cancelled', 'completed')`)
@Check(`"booking_type" IN ('hotel', 'car_rental', 'tour')`)
@Index("idx_bookings_customer_id", ["customer_id"])
@Index("idx_bookings_property_id", ["property"])
@Index("idx_bookings_dates", ["check_in_date", "check_out_date"])
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  customer_id!: string;

  @ManyToOne(() => Property, { onDelete: "CASCADE" })
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @Column({ type: "text" })
  booking_type!: "hotel" | "car_rental" | "tour";

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: "room_type_id" })
  roomType?: RoomType;

  @Column({ type: "int", nullable: true, default: 1 })
  rooms_count?: number;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: "vehicle_id" })
  vehicle?: Vehicle;

  @ManyToOne(() => TourPackage, { nullable: true })
  @JoinColumn({ name: "tour_package_id" })
  tourPackage?: TourPackage;

  @Column({ type: "int", nullable: true, default: 1 })
  participants_count?: number;

  @Column({ type: "date" })
  check_in_date!: string;

  @Column({ type: "date" })
  check_out_date!: string;

  @Column({ type: "numeric", precision: 10, scale: 2 })
  total_amount!: number;

  @Column({ type: "text", default: "pending" })
  booking_status!: "pending" | "confirmed" | "cancelled" | "completed";

  @Column({ type: "text", default: "pending" })
  payment_status!: "pending" | "paid" | "refunded";

  @Column({ type: "text", nullable: true })
  special_requests?: string;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
