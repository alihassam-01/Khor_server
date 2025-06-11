// this entity shows the relation between a booking and service options. such as if a booking item has added features(mountain view, king bed)

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BookingItems } from "./booking-items.entity";
import { ServiceOptions } from "@entity/property";

@Entity()
export class BookingItemOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => BookingItems, item => item.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_item_id" })
  bookingItem!: BookingItems;

  @ManyToOne(() => ServiceOptions, { eager: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "option_id" })
  option!: ServiceOptions;

  @Column({ type: "varchar", length: 100 })
  value!: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  price_adjustment!: number;
}
