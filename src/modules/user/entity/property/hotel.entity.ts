import { Entity, Column, PrimaryColumn, OneToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Property } from './property.entity';
import { RoomType } from '../room/room-type.entity';

@Entity()
export class Hotel {
  @PrimaryColumn()
  property_id!: number;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn()
  property!: Property;

  @Column()
  hotel_name!: string;

  @Column()
  hotel_location!: string;

  @CreateDateColumn()
  created_at!: Date;

  @OneToMany(() => RoomType, room => room.property)
  rooms!: RoomType[];
}
