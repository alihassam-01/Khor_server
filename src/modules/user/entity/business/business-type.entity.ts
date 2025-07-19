import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  // OneToMany,
} from "typeorm";
// import { Property } from "../property";

@Entity()
export class BusinessType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  // @OneToMany(() => Property, (profile) => profile.businessType)
  // property!: Property[];
}
