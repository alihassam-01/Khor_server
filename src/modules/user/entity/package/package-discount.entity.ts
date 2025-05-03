import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Unique } from 'typeorm';
import { Package } from './package.entity';
import { Discount } from './discount.entity';

@Entity()
@Unique(['package', 'discount', 'discount_start_date'])
export class PackageDiscount {
  @PrimaryGeneratedColumn()
  package_discount_id!: number;

  @ManyToOne(() => Package, pkg => pkg.discounts, { onDelete: 'CASCADE' })
  package!: Package;

  @ManyToOne(() => Discount, discount => discount.discounts, { onDelete: 'CASCADE' })
  discount!: Discount;

  @Column()
  discount_start_date!: string;

  @Column()
  discount_end_date!: string;

  @CreateDateColumn()
  created_at!: Date;
}
