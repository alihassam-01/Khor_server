import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Booking } from "./booking.entity";

@Entity()
export class Refund {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne(() => Booking, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking!: Booking;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  refund_amount!: number;

  @Column()
  reason!: string;

  @Column()
  created_at!: Date;

  @Column({ default: "pending", enum: ["pending", "processed", "failed", "denied"] })
  refund_status!: string;

  @Column({ enum: ["full", "partial"], nullable: true})
  refund_type!: string;

  @Column({ nullable: true })
  processed_at!: Date;
}
