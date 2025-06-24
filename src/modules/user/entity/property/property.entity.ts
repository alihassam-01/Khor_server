import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Index,
} from "typeorm";
import { Vendor } from "../business";
import { RoomType } from "../room";
import { Vehicle } from "./vehicle.entity";
import { TourPackage } from "./tour-package.entity";
import { Deal } from "../bookings/deal.entity";

@Entity("properties")
@Check(`"type" IN ('hotel', 'car_rental', 'tour')`)
@Index("idx_properties_vendor_id", ["vendor"])
@Index("idx_properties_type", ["type"])
export class Property {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.properties, {
    onDelete: "CASCADE",
  })
  vendor!: Vendor;

  @OneToMany(() => Deal, (deal) => deal.property)
  deals!: Deal[];

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text" })
  type!: "hotel" | "car_rental" | "tour";

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text" })
  location!: string;

  @Column({ type: "text", nullable: true })
  address?: string;

  @Column({ type: "numeric", precision: 2, scale: 1, default: 0 })
  rating!: number;

  @Column("text", { array: true, nullable: true })
  amenities?: string[];

  @Column("text", { array: true, nullable: true })
  images?: string[];

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(() => RoomType, (room) => room.property)
  roomTypes!: RoomType[];

  @OneToMany(() => Vehicle, (vehicle) => vehicle.property)
  vehicles!: Vehicle[];

  @OneToMany(() => TourPackage, (tour) => tour.property)
  tourPackages!: TourPackage[];
}
