import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Column,
} from "typeorm";
import { Property } from "../property";
import { User } from "../user";
import { Payout } from "../payout";

@Entity("vendors")
export class Vendor {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 255, nullable: true})
  username!: string;

  @Column({ nullable: true })
  profile_picture?: string;

  @OneToMany(() => Property, (property) => property.vendor)
  properties!: Property[];

  @OneToOne(() => User, (user) => user.vendor)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @OneToMany(() => Payout, (payout) => payout.vendor)
  payouts!: Payout[];
}
