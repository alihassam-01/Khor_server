import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('room_inventory')
export class RoomInventory {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id!: string;

  @Column('uuid')
  room_id!: string;

  @Column('date')
  date!: Date;

  @Column('integer')
  room_number!: number;

  @Column({ default: 'available' })
  status!: 'available' | 'booked' | 'unavailable';

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  updated_at!: Date;
}