import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  TableInheritance,
  OneToMany,
} from "typeorm";
import { Vendor, BusinessType } from "@entity/business";
import { BookingItems } from "@entity/bookings";

@Entity()
@TableInheritance({ column: { type: "varchar", name: "property_type" } })
export class Property {
  @PrimaryGeneratedColumn()
  property_id!: number;

  @ManyToOne(() => Vendor, (vendor) => vendor.properties, {
    onDelete: "CASCADE",
  })
  vendor!: Vendor;

  @ManyToOne(() => BusinessType, (businessType) => businessType.property)
  businessType!: BusinessType;

  @Column({ type: "text", nullable: true })
  markup_file_location!: string;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => BookingItems, (item) => item.property)
  bookingItems!: BookingItems[];
}
