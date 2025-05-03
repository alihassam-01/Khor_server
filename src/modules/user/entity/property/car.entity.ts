import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity()
export class Car {
  @PrimaryColumn()
  property_id!: number;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn()
  property!: Property;

  @Column()
  car_name!: string;

  @Column()
  car_model!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  car_price!: number;

  @Column({ default: true })
  car_availability!: boolean;

  @Column({ nullable: true })
  car_type!: string;

  @CreateDateColumn()
  created_at!: Date;
}
