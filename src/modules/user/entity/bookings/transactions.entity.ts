import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, Index } from "typeorm";
import { Booking } from "./booking.entity";
import { Payment } from "./payment.entity";


@Entity()
@Index("idx_transactions_customer_id", ["customer_id"])
@Index("idx_transactions_booking_id", ["booking"])
@Index("idx_transactions_status", ["status"])
@Index("idx_transactions_transaction_date", ["transaction_date"])
export class Transactions {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "uuid", nullable: false })
  customer_id!: string;

  @ManyToOne(() => Booking, { onDelete: "CASCADE" })
  booking!: Booking;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
  amount!: number;

  @Column({ type: "varchar", length: 50, nullable: false })
  payment_method!: string;

  @Column({ type: "timestamptz", nullable: false, default: () => "CURRENT_TIMESTAMP" })
  transaction_date!: Date;

  @Column({ type: "varchar", length: 50, nullable: false })
  status!: string;

  @Column({ type: "text", nullable: true })
  failure_reason?: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  failure_code?: string; 

  @OneToMany(() => Payment, (payment) => payment.transaction, { cascade: true })
  payments!: Payment[];
}
