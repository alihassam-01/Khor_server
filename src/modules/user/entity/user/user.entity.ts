import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
// import { TravelAgencyProfile } from './travel-agency-profile.entity';
import { CustomerProfile } from './customer-profile.entity';
import { UserType } from '@entity/ENUM/enum';
import { Vendor } from '../business';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // Will be hashed

  @Column({ type: 'enum', enum: UserType })
  userType!: UserType;

  @Column({ nullable: true })
  verificationToken?: string;

  @Column({ default: false })
  isVerified: boolean = false;

  // @OneToOne(() => TravelAgencyProfile, (profile) => profile.user, { nullable: true })
  // agencyProfile?: TravelAgencyProfile;
  @OneToOne(() => Vendor, (vendor) => vendor.user, { nullable: true })
  vendor?: Vendor;

  @OneToOne(() => CustomerProfile, (profile) => profile.user, { nullable: true })
  customerProfile?: CustomerProfile;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}