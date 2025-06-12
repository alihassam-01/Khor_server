import { ChildEntity, Column, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { Property } from './property.entity';
import { RoomType } from '../room/room-type.entity';
import { Address } from '../address';

@ChildEntity('hotel')
export class Hotel extends Property {
  // hotel_id!: number; // Inherits from Property
  @Column()
  hotel_name!: string;

  @Column({ name: 'address_id', nullable: true })
   addressId?: number;
 
   // Relationship with explicit JoinColumn
   @OneToOne(() => Address, { nullable: true })
   @JoinColumn({ name: 'address_id' })
   address?: Address;

  // @CreateDateColumn()
  // created_at!: Date;

  @OneToMany(() => RoomType, room => room.property)
  rooms!: RoomType[];
}
