import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Property } from "../property";

@Entity("room_types")
@Index("idx_room_types_property_id", ["property"])
export class RoomType {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Property, (property) => property.roomTypes, {
    onDelete: "CASCADE",
  })
  property!: Property;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column("numeric", { precision: 10, scale: 2 })
  base_price!: number;

  @Column("int", { default: 2 })
  max_occupancy!: number;

  @Column("int", { nullable: true })
  size_sqm?: number;

  @Column("text", { array: true, nullable: true })
  amenities?: string[];

  @Column("text", { array: true, nullable: true })
  images?: string[];

  @Column("int", { default: 1 })
  total_rooms!: number;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
