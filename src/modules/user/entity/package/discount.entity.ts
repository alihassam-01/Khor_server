import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PackageDiscount } from './package-discount.entity';

@Entity()
export class Discount {
  @PrimaryGeneratedColumn()
  discount_id!: number;

  @Column({ length: 50 })
  discount_name!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discount_percent!: number;

  @Column({ type: 'text', nullable: true })
  discount_description!: string;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => PackageDiscount, pd => pd.discount)
  discounts!: PackageDiscount[];
}
