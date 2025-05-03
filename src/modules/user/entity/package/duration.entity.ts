import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Package } from './package.entity';

@Entity()
export class Duration {
  @PrimaryGeneratedColumn()
  duration_id!: number;

  @OneToOne(() => Package, pkg => pkg.duration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'package_id' })
  package!: Package;

  @Column()
  total_days!: number;

  @Column()
  total_nights!: number;

  @CreateDateColumn()
  created_at!: Date;
}
