import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne } from "typeorm";
import { BookingItems } from "./booking-items.entity";
import { Transactions } from "./transactions.entity";

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false })
  customerId!: number;

  @Column({ type: "varchar", length: 50, nullable: false })
  status!: string;

  @Column({ type: "timestamp", nullable: false })
  bookingDate!: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  totalAmount!: number;

  @OneToMany(() => BookingItems, item => item.booking)
  items!: BookingItems[];

  @OneToOne(() => Transactions, transaction => transaction.booking)
  transaction!: Transactions;
}
