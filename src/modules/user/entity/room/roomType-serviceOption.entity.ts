// this file links the room type with service options allowing total price calculation

import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from "typeorm";
import { RoomType } from "./room-type.entity";
import { ServiceOptions } from "../property/service-options.entity";

@Entity("room_type_service_options")
export class RoomTypeServiceOption {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => RoomType, (roomType) => roomType.serviceOptions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "room_type_id" })
  roomType!: RoomType;

  @ManyToOne(() => ServiceOptions, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "service_option_id" })
  serviceOption!: ServiceOptions;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  additionalCost!: number;
}
