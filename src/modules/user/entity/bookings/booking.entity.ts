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
  OneToOne,
} from "typeorm";
import { Property } from "../property";
import { RoomType } from "../room";
import { Vehicle } from "../property/vehicle.entity";
import { TourPackage } from "../property/tour-package.entity";
import { Transactions } from "./transactions.entity";
import { User } from "../user";

@Entity("bookings")
@Check(`"payment_status" IN ('pending', 'paid', 'refunded')`)
@Check(`"booking_status" IN ('pending', 'confirmed', 'cancelled', 'completed')`)
@Check(`"booking_type" IN ('hotel', 'car_rental', 'tour')`)
@Index("idx_bookings_customer", ["customer"])
@Index("idx_bookings_property_id", ["property"])
@Index("idx_bookings_dates", ["check_in_date", "check_out_date"])
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

// booking and user relationship
  @ManyToOne(() => User, (user) => user.bookings, { onDelete: "CASCADE" })
  @JoinColumn({ name: "customer_id" })
  customer!: User;

  @ManyToOne(() => Property, { onDelete: "CASCADE" })
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @Column({ type: "text" })
  booking_type!: "hotel" | "car_rental" | "tour";

  @ManyToOne(() => RoomType, { nullable: true })
  @JoinColumn({ name: "room_type_id" })
  roomType?: RoomType;

  @Column({ type: "int", nullable: true })
  rooms_count?: number;

  @ManyToOne(() => Vehicle, { nullable: true })
  @JoinColumn({ name: "vehicle_id" })
  vehicle?: Vehicle;

  @ManyToOne(() => TourPackage, { nullable: true })
  @JoinColumn({ name: "tour_package_id" })
  tourPackages?: TourPackage;

  @Column({ type: "int", nullable: true, default: 1 })
  participants_count?: number;

  @Column({ type: "timestamptz" })
  check_in_date!: string;

  @Column({ type: "timestamptz" })
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
  @OneToOne(() => Transactions, (transaction) => transaction.booking)
  transaction!: Transactions;
}
// }
