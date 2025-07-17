import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  // Check,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { Property } from "@entity/property";
import { Location } from "@entity/location";

@Entity("tour_packages")
@Index("idx_tour_packages_property_id", ["property"])
export class TourPackage {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.tourPackages, {
    onDelete: "CASCADE",
    nullable: false,
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
  category!: "standard" | "premium" | "luxury";

  @Column({ type: "text", nullable: true })
  type!: "hotel-only" | "car-rental" | "complete-package";

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @ManyToMany(() => Location)
  @JoinTable({
    name: "tour_package_destinations",
  })
  destinations?: Location[];

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
