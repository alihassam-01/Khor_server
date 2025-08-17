import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Transactions } from "../bookings";
import { Vendor } from "../business";

@Entity("payout")
@Index("idx_payout_vendor_id", ["vendor"])
export class Payout {
  @PrimaryGeneratedColumn("uuid")
  payout_id!: string;

  // ----- Columns -----

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : 0),
    },
  })
  amount!: number;

  @Column({
    type: "decimal",
    precision: 5,
    scale: 2,
    default: 0.03, // database-level default
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) =>
        value !== null ? parseFloat(value) : 0.03,
    },
  })
  fee_percent!: number;

  @ManyToOne(() => Vendor, { nullable: false })
  @JoinColumn({ name: "vendor_id" })
  vendor!: Vendor;

  @OneToOne(() => Transactions, { nullable: false })
  @JoinColumn({ name: "transaction_id" })
  transaction!: Transactions;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | null) => (value !== null ? parseFloat(value) : 0),
    },
  })
  payout_amount!: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  payment_date!: Date;

  @Column({
    type: "enum",
    enum: ["pending", "completed", "failed"],
    default: "pending",
  })
  status!: "pending" | "completed" | "failed";

  // ----- Hooks -----

  @BeforeInsert()
  @BeforeUpdate()
  calculatePayoutAmount() {
    const amountNum = this.amount;
    const feePercentNum =
      this.fee_percent !== undefined && this.fee_percent !== null
        ? this.fee_percent
        : 0.03; // enforce default at entity level

    if (isNaN(amountNum) || isNaN(feePercentNum)) {
      throw new Error(
        `Invalid payout calculation: amount=${this.amount}, fee_percent=${this.fee_percent}`
      );
    }

    this.payout_amount = amountNum - amountNum * feePercentNum;
  }
}
