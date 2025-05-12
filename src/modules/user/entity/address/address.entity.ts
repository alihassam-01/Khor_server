import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Locality } from "./locality.entity";
import { User } from "../user";

@Entity('address')
export class Address {
  @PrimaryGeneratedColumn()
  address_id!: number;

  @Column('text', { nullable: false })
  street_address!: string;

  @ManyToOne(() => Locality, locality => locality.addresses)
  @JoinColumn({ name: 'locality_id' })
  locality!: Locality;

  @Column('varchar', { length: 255, nullable: true })
  landmark!: string;

  @Column('boolean', { default: false })
  is_primary!: boolean;

  // one to one with user
  @OneToOne(() => User, user => user.address)
  user?: User;
}