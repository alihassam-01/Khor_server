import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Booking } from "./booking.entity";

@Entity()
export class Refund {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne(() => Booking, { onDelete: "CASCADE" })
  @Column()
  booking_id!: string;

  booking!: Booking;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  refund_amount!: number;

  @Column()
  reason!: string;

  @Column()
  created_at!: Date;

  @Column({ default: "pending" })
  refund_status!: string;

  @Column({ nullable: true })
  processed_at!: Date;
}
