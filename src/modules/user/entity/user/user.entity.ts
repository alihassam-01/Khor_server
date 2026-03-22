import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { CustomerProfile } from './customer-profile.entity';
import { UserType } from '@modules/user/entity/ENUM/enum';
import { Vendor } from '@modules/user/entity/business';
import { Address } from '@modules/user/entity/address';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  password?: string; // Will be hashed (null for OAuth users)

  @Column({ nullable: true })
  googleId?: string;

  @Column({ default: 'local' })
  authProvider: string = 'local';

  @Column({ type: 'enum', enum: UserType })
  userType!: UserType;

  @Column({ nullable: true })
  verificationToken?: string;

  @Column({ default: false })
  isVerified: boolean = false;

  @Column({ name: 'address_id', nullable: true })
  addressId?: number;

  // Relationship with explicit JoinColumn
  @OneToOne(() => Address, { nullable: true })
  @JoinColumn({ name: 'address_id' })
  address?: Address;

  @OneToOne(() => Vendor, (vendor) => vendor.user, { nullable: true })
  vendor?: Vendor;

  @OneToOne(() => CustomerProfile, (profile) => profile.user, { nullable: true })
  customerProfile?: CustomerProfile;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ default: true })
  isActive!: boolean;
}