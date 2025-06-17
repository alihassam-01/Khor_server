import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from "typeorm";
import { RoomType } from "./room-type.entity";

// room inventory shall handle, room type id, available rooms,

@Entity("room_inventory")
export class RoomInventory {
  @PrimaryColumn("uuid", { default: () => "gen_random_uuid()" })
  id!: string;

  // room_typeId foreign key to room type
  /**
   * Foreign key referencing the Room Type table.
   * Represents the unique identifier of the associated room type for this room inventory.
   */
  @OneToOne(() => RoomType, (roomType) => roomType.roomInventory, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "room_type_id" })
  roomType!: RoomType;

  //available rooms
  @Column({ type: "integer", default: 0 })
  available_rooms!: number;

  // Add a check constraint to ensure available_rooms >= 0 and available_rooms <= total_rooms from room_type
  static checkConstraints = [
    `CHECK ("available_rooms" >= 0)`,
    `CHECK ("available_rooms" <= (SELECT "total_rooms" FROM "room_type" WHERE "room_type"."id" = "room_inventory"."room_type_id"))`
  ];

  @Column({ type: "timestamp with time zone", default: () => "NOW()" })
  created_at!: Date;

  @Column({ type: "timestamp with time zone", default: () => "NOW()" })
  updated_at!: Date;
}
