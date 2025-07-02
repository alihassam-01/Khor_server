import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Location } from "@entity/location";
import { User } from "@entity/user";
import { Property } from "../property";
// import { Hotel } from "../property";

@Entity("address")
export class Address {
  @PrimaryGeneratedColumn()
  address_id!: number;

  @Column("text", { nullable: false })
  street_address!: string;

  @ManyToOne(() => Location, (location) => location.addresses)
  @JoinColumn({ name: "location_id" })
  location!: Location;

  @Column("varchar", { length: 255, nullable: true })
  landmark!: string;

  @Column("boolean", { default: false })
  is_primary!: boolean;

  // one to one with user
  @OneToOne(() => User, (user) => user.address)
  user?: User;
  // @OneToOne(() => Hotel, (hotel) => hotel.address)
  // hotel?: Hotel;
  @OneToMany(() => Property, (property) => property.address)
properties?: Property[];
}
