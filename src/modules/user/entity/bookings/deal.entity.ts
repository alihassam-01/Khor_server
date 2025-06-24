import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from "typeorm";
import { Property } from "../property";

@Entity("deals")
@Check(`"deal_type" IN ('percentage', 'fixed_amount', 'buy_one_get_one')`)
@Check(`"applicable_to" IN ('all', 'room_types', 'vehicles', 'tour_packages')`)
@Index("idx_deals_property_id", ["property"])
@Index("idx_deals_dates", ["valid_from", "valid_until"])
export class Deal {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.deals, {
    onDelete: "CASCADE",
  })
  property!: Property;

  @Column({ type: "text" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text" })
  deal_type!: "percentage" | "fixed_amount" | "buy_one_get_one";

  @Column("numeric", { precision: 10, scale: 2 })
  discount_value!: number;

  @Column("int", { default: 1, nullable: true })
  minimum_stay!: number;

  @Column({ type: "date" })
  valid_from!: string;

  @Column({ type: "date" })
  valid_until!: string;

  @Column("int", { nullable: true })
  max_uses?: number;

  @Column("int", { default: 0 })
  used_count!: number;

  @Column({ type: "text" })
  applicable_to!: "all" | "room_types" | "vehicles" | "tour_packages";

  @Column("uuid", { array: true, nullable: true })
  applicable_resources?: string[];

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
