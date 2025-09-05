import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
// import { TravelAgencyProfile } from './travel-agency-profile.entity';
import { CustomerProfile } from './customer-profile.entity';
import { UserType } from '../ENUM/enum';
import { Vendor } from '../business';
import { Address } from '../address';
import { Booking } from '../bookings';
import { Review } from '../review/review.entity';

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

  @OneToMany(() => Booking, (booking) => booking.customer)
  bookings?: Booking[];

  @OneToMany(() => Review, (review) => review.user)
  reviews?: Review[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ default: true })
  isActive!: boolean;
}