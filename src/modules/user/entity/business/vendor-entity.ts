// import {
//   Entity,
//   PrimaryGeneratedColumn,
//   Column,
//   CreateDateColumn,
//   UpdateDateColumn,
//   OneToMany,
//   OneToOne,
//   JoinColumn,
// } from "typeorm";
// import { Package } from "../package/package.entity";
// import { Property } from "../property/property.entity";
// import { User } from "../user/user.entity";
// import { BusinessVerification } from "./business-verification.entity";

// @Entity()
// export class Vendor {
//   @PrimaryGeneratedColumn("uuid")
//   id!: string;

//   @Column({ length: 100 })
//   companyName!: string;

//   @Column({ length: 15, unique: true, nullable: true })
//   cnic!: string;

//   @Column({ default: false })
//   isVerified!: boolean;

//   @Column({ type: "text", nullable: true })
//   markupFileLocation!: string;

//   // @Column({ type: "text", nullable: false })
//   // location!: string;

//   @Column({ type: "text", nullable: true })
//   description!: string;

//   @Column({ default: false })
//   isDeleted!: boolean;

//   @CreateDateColumn()
//   createdAt!: Date;

//   @UpdateDateColumn()
//   updatedAt!: Date;

//   @Column({ nullable: true })
//   lastVerifiedAt!: Date;

//   @OneToMany(() => Package, (pkg) => pkg.vendor)
//   packages!: Package[];

//   @OneToMany(() => Property, (property) => property.vendor)
//   properties!: Property[];

//   @OneToOne(() => User, (user) => user.vendor)
//   @JoinColumn()
//   user!: User;

//   @OneToMany(() => BusinessVerification, (verification) => verification.vendor)
//   verifications!: BusinessVerification[];
// }
import { Entity, PrimaryGeneratedColumn, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { Property } from "../property";
import { User } from "../user";

@Entity("vendors")
export class Vendor {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToMany(() => Property, (property) => property.vendor)
  properties!: Property[];

 @OneToOne(() => User, (user) => user.vendor)
@JoinColumn({ name: "user_id" })
user!: User;
}