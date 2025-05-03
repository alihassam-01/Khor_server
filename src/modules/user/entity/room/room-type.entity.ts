import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Hotel } from '../property/hotel.entity';

@Entity()
export class RoomType {
  @PrimaryGeneratedColumn()
  room_type_id!: number;

  @ManyToOne(() => Hotel, hotel => hotel.rooms, { onDelete: 'CASCADE' })
  property!: Hotel;

  @Column({ length: 50 })
  room_type_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  room_type_price!: number;

  @Column({ type: 'text', nullable: true })
  room_type_description!: string;

  @Column()
  room_type_max_capacity!: number;

  @Column()
  available_rooms!: number;

  @Column({ type: 'text', nullable: true })
  markup_file_location!: string;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
