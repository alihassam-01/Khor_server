import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  OneToOne,
} from "typeorm";
import { LocationAttributes, LocationCategoryMapping } from "@entity/location";
// import { PackageLocation } from "@entity/package";
import { Address, City } from "@entity/address";
import { TourPackage } from "@entity/property";

@Entity("location")
export class Location {
  @PrimaryGeneratedColumn()
  location_id!: number;

  @Column("varchar", { length: 255, nullable: false })
  name!: string;

  @Column("varchar", { length: 20, nullable: true })
  plusCode!: string;

  @Column("int", { default: 0 })
  location_order!: number;

  @Column("text", { nullable: true })
  description!: string;

  @Column("boolean", { default: false })
  is_deleted!: boolean;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @Column({ type: "varchar", length: 100, nullable: false, unique: true })
  slug!: string;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at!: Date;

  @ManyToOne(() => Location, (location) => location.children, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "parent_location_id" })
  parent!: Location;

  @OneToMany(() => Location, (location) => location.parent)
  children!: Location[];

  @OneToMany(() => LocationAttributes, (attr) => attr.place, { cascade: true })
  attributes!: LocationAttributes[];

  @OneToMany(() => LocationCategoryMapping, (mapping) => mapping.location, {
    cascade: true,
  })
  categoryMappings!: LocationCategoryMapping[];

 @ManyToMany(() => TourPackage, (tourPackage) => tourPackage.destinations)
tourPackages?: TourPackage[];

  @OneToMany(() => Address, (address) => address.location)
  addresses!: Address[];

  @OneToOne(() => City, (city) => city.location)
city!: City;
}
