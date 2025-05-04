import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Package } from "../package/package.entity";
import { Property } from "../property/property.entity";
import { User } from "../user";

@Entity()
export class Vendor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  companyName!: string;

  @Column({ length: 15, unique: true })
  cnic!: string;

  @Column({ default: false })
  verified!: boolean;

  @Column({ type: "text", nullable: true })
  markupFileLocation!: string;

  @Column({ default: false })
  isDeleted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Package, (pkg) => pkg.vendor)
  packages!: Package[];

  @OneToMany(() => Property, (property) => property.vendor)
  properties!: Property[];

  @OneToOne(() => User, (user) => user.vendor)
  @JoinColumn()
  user!: User;
}
