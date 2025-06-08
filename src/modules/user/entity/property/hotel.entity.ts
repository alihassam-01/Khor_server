import { ChildEntity, Column, OneToMany } from 'typeorm';
import { Property } from './property.entity';
import { RoomType } from '../room/room-type.entity';

@ChildEntity('hotel')
export class Hotel extends Property {
  @Column()
  hotel_name!: string;

  @Column()
  hotel_location!: string;

  // @CreateDateColumn()
  // created_at!: Date;

  @OneToMany(() => RoomType, room => room.property)
  rooms!: RoomType[];
}
