import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
// import { Package } from '@entity/package';
import { Property } from '@entity/property';
import { ReviewStatus } from '@entity/ENUM/enum';

@Entity()
export class Review {
  @PrimaryGeneratedColumn()
  review_id!: number;

  // @ManyToOne(() => Package, pkg => pkg.reviews, { onDelete: 'CASCADE' })
  // package!: Package;

  @ManyToOne(() => Property, { onDelete: 'SET NULL' })
  property!: Property;

  @Column({ type: 'text', nullable: true })
  review_tex!: string;

  @Column({ nullable: true })
  rating!: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  review_date!: string;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.NOT_REVIEWED })
  review_status!: ReviewStatus;

  @Column({ default: 0 })
  helpful_count!: number;

  @Column({ default: 0 })
  not_helpful_count!: number;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
