import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Property } from "../property";
@Entity("listing_price")
// index
@Index("idx_listing_price_property_id", ["property"])
@Index("idx_listing_price_dates", ["created_at", "updated_at"])
export class ListingPrice {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, { onDelete: "CASCADE" })
  @JoinColumn({ name: "property_id" })
  property!: Property;

  @Column({ type: "varchar" })
  entity_type!: "room" | "vehicle" | "tour"; // discriminator

  @Column({ type: "uuid" })
  entity_id!: string; // ID of room/vehicle/tour

  @Column({ type: "numeric", precision: 10, scale: 2 })
  base_price!: number; // What you pay the vendor

@Column({ type: "numeric", precision: 10, scale: 2 })
selling_price!: number; // What customer pays
@BeforeInsert()
@BeforeUpdate()
setSellingPrice() {
    const commission = this.commission_rate ?? 0.08;
    this.selling_price = Number(this.base_price) * (1 + Number(commission));
}

@Column({ type: "numeric", precision: 5, scale: 2, nullable: true, default: 0.08 })
commission_rate?: number; // Your commission percentage, default 8%

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
