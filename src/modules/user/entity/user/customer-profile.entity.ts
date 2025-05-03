import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class CustomerProfile {
  @Column({ primary: true })
  userId!: string;

  @OneToOne(() => User, (user) => user.customerProfile)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  username!: string; // For customers

  @Column({ nullable: true })
  phoneNumber?: string;
  
}