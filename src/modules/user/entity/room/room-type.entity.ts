// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   CreateDateColumn,
//   UpdateDateColumn,
//   ManyToOne,
//   // OneToMany,
//   OneToMany,
//   OneToOne,
// } from "typeorm";
// import { Hotel } from "../property/hotel.entity";
// import { RoomTypeServiceOption } from "./roomType-serviceOption.entity";
// import { RoomInventory } from "./room-inventory.entity";
// // import { Booking } from "../bookings";

// // typeid, name, base_price, description, max_capacity, tatal_rooms, service_id,

// @Entity()
// export class RoomType {
//   @PrimaryGeneratedColumn()
//   room_type_id!: number;

//   @ManyToOne(() => Hotel, (hotel) => hotel.rooms, { onDelete: "CASCADE" })
//   property!: Hotel;

//   @Column({ length: 50 })
//   room_type_name!: string;

//   @Column({ type: "decimal", precision: 10, scale: 2 })
//   room_type_base_price!: number;

//   @Column({ type: "text", nullable: true })
//   room_type_description!: string;

//   @Column()
//   room_type_max_capacity!: number;

//   @Column()
//   total_rooms!: number;

//   // @OneToMany(() => RoomTypeImage, image => image.roomType)
//   // images!: RoomTypeImage[];

//   @OneToMany(
//     () => RoomTypeServiceOption,
//     (roomTypeServiceOption) => roomTypeServiceOption.roomType,
//     { cascade: true }
//   )
//   serviceOptions!: RoomTypeServiceOption[];
//   @CreateDateColumn()
//   created_at!: Date;

//   @UpdateDateColumn()
//   updated_at!: Date;
//   @Column({ type: "text", nullable: true })
//   markup_file_location!: string;

//   @Column({ default: false })
//   is_deleted!: boolean;

//   // one to one with room_inventory
//   @OneToOne(() => RoomInventory, (roomInventory) => roomInventory.roomType)
//   roomInventory!: RoomInventory;

//   // booking
//   // @OneToOne(() => Booking, booking => booking.roomType)
//   // booking!: Booking;
// }


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
