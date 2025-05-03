import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { Profile } from '@entity/profile/profile.entity';

@Entity('business_verification')
export class BusinessVerification {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @ManyToOne(() => Profile, profile => profile.verification)
  profile!: Profile;

  @Column()
  document_type!: string;

  @Column()
  document_url!: string;

  @Column({ nullable: true })
  cnic_number!: string;

  @Column({ default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  submitted_at!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  reviewed_at!: Date;

  @Column({ nullable: true })
  reviewer_notes!: string;

}