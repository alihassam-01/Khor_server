import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Package } from '@entity/package';
import { MealType } from '@entity/ENUM/enum';

@Entity()
export class Meal {
  @PrimaryGeneratedColumn()
  meal_id!: number;

  @ManyToOne(() => Package, pkg => pkg.meals, { onDelete: 'CASCADE' })
  package!: Package;

  @Column()
  meal_name!: string;

  @Column({ type: 'enum', enum: MealType })
  meal_type!: MealType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  meal_price!: number;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'text', nullable: true })
  markup_file_location!: string;

  @Column({ default: 0 })
  day_number!: number;

  @CreateDateColumn()
  created_at!: Date;
}
