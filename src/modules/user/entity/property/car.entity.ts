import { ChildEntity, Column } from 'typeorm';
import { Property } from './property.entity';

@ChildEntity('car')
export class Car extends Property {
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

  // @CreateDateColumn()
  // created_at!: Date;
}
