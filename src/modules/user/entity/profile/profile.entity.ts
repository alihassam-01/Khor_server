import { Entity, PrimaryColumn, Column, OneToOne } from 'typeorm';
import { BusinessVerification } from '@entity/business';
import { BusinessStatus, BusinessType } from '@entity/ENUM/enum';


@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'enum', enum: BusinessType })
  business_type!: BusinessType;

  @Column()
  business_name!: string;

  @Column()
  owner_name!: string;

  @Column()
  location!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ type: 'enum', enum: BusinessStatus, default: BusinessStatus.RUNNING })
  business_status!: BusinessStatus;

  @Column('text', { array: true })
  location_tags!: string[];

  @OneToOne(() => BusinessVerification, (verification: BusinessVerification) => verification.profile)
  verification!: BusinessVerification;

}