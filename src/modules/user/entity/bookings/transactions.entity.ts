import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne
} from "typeorm";
import { Booking } from "./booking.entity";

@Entity()
export class Transactions {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int", nullable: false })
  customer_id!: number;

  @ManyToOne(() => Booking, { onDelete: "CASCADE" })
  booking!: Booking;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: "varchar", length: 50, nullable: false })
  payment_method!: string;

  @Column({ type: "timestamp", nullable: false })
  transaction_date!: Date;

  @Column({ type: "varchar", length: 50, nullable: false })
  status!: string;
}
