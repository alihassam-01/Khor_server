// id, name, possible values string[], serviceTypeId(propertyTypeId)

import { Column, Entity,PrimaryGeneratedColumn } from "typeorm";
// import { RoomTypeServiceOption } from "../room/roomType-serviceOption.entity";
// import { BookingItemOption } from "../bookings";

@Entity("service_options")
export class ServiceOptions {
  @PrimaryGeneratedColumn({ name: "option_id" })
  id!: number;
  @Column({ type: "varchar", length: 100, nullable: false })
  name!: string; // e.g., "WiFi", "Breakfast"
  @Column("simple-array", { nullable: true })
  possibleValues!: string[]; // e.g., ["king-bed", "mountain-view", "child-seat"]
  @Column({ type: "varchar", length: 50, nullable: false })
  propertyType!: string;
  @Column({ type: "boolean", default: false })
  isPrimaryOption!: boolean; // Marks options that define a "sub-type" of service
  @Column({ type: "boolean", default: false })
  isDeleted!: boolean; // Soft delete flag
  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date; // Creation timestamp
  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date; // Update timestamp

  // @OneToMany(
  //   () => RoomTypeServiceOption,
  //   (roomTypeServiceOption) => roomTypeServiceOption.serviceOption
  // )
  // roomTypes!: RoomTypeServiceOption[];
}
