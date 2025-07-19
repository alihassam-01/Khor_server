import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  Check,
} from "typeorm";

@Entity("availability")
@Unique("availability_resource_type_resource_id_date_key", ["resource_type", "resource_id", "date"])
@Check(`"resource_type" IN ('room_type', 'vehicle', 'tour_package')`)
@Index("idx_availability_resource", ["resource_type", "resource_id", "date"])
export class Availability {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  resource_type!: "room_type" | "vehicle" | "tour_package";

  @Column("uuid")
  resource_id!: string;

  @Column({ type: "date" })
  date!: string;

  @Column({ type: "int", default: 0 })
  available_quantity!: number;

  @Column("numeric", { precision: 10, scale: 2, nullable: true })
  base_price?: number;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
