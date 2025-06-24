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

@Entity("tour_packages")
@Check(`"difficulty_level" IN ('easy', 'moderate', 'challenging')`)
@Index("idx_tour_packages_property_id", ["property"])
export class TourPackage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.tourPackages, {
    onDelete: "CASCADE",
  })
  property!: Property;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "int", default: 1 })
  duration_days!: number;

  @Column("int")
  max_participants!: number;

  @Column("numeric", { precision: 10, scale: 2 })
  price_per_person!: number;

  @Column("text", { array: true, nullable: true })
  includes?: string[];

  @Column({ type: "jsonb", nullable: true })
  itinerary?: object;

  @Column("text", { array: true, nullable: true })
  images?: string[];

  @Column({ type: "text", nullable: true })
  difficulty_level?: "easy" | "moderate" | "challenging";

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
