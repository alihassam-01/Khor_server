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
} from "typeorm";
import { Property } from "../property";
import { RoomType } from "../room";
import { Vehicle } from "../property/vehicle.entity";
import { TourPackage } from "../property/tour-package.entity";

@Entity({ name: "bookings" })
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  customer_id!: string;

  @ManyToOne(() => Property)
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @Column()
  booking_type!: "hotel" | "car_rental" | "tour";

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: "room_type_id" })
  roomType?: RoomType;

  @Column({ nullable: true })
  rooms_count?: number;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: "vehicle_id" })
  vehicle?: Vehicle;

  @ManyToOne(() => TourPackage, { nullable: true })
  @JoinColumn({ name: "tour_package_id" })
  tourPackage?: TourPackage;

  @Column({ nullable: true })
  participants_count?: number;

  @Column({ type: "date" })
  check_in_date!: string;

  @Column({ type: "date" })
  check_out_date!: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total_amount!: number;

  @Column({ default: "pending" })
  booking_status!: "pending" | "confirmed" | "cancelled" | "completed";

  @Column({ default: "pending" })
  payment_status!: "pending" | "paid" | "refunded";

  @Column({ nullable: true })
  special_requests?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
