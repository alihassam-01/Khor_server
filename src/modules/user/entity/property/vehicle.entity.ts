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
import { Property } from "./property.entity";

@Entity("vehicles")
@Check(`"fuel_type" IN ('petrol', 'diesel', 'electric', 'hybrid')`)
@Check(`"transmission" IN ('manual', 'automatic')`)
@Index("idx_vehicles_property_id", ["property"])
export class Vehicle {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.vehicles, {
    onDelete: "CASCADE",
  })
  property!: Property;

  @Column({ type: "text" })
  make!: string;

  @Column({ type: "text" })
  model!: string;

  @Column({ type: "int" })
  year!: number;

  @Column({ type: "text" })
  type!: string;

  @Column({ type: "text" })
  transmission!: "manual" | "automatic";

  @Column({ type: "text" })
  fuel_type!: "petrol" | "diesel" | "electric" | "hybrid";

  @Column({ type: "int" })
  seats!: number;

  @Column("numeric", { precision: 10, scale: 2 })
  daily_rate!: number;

  @Column("text", { array: true, nullable: true })
  features?: string[];

  @Column("text", { array: true, nullable: true })
  images?: string[];

  @Column({ type: "text", nullable: true })
  license_plate?: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
