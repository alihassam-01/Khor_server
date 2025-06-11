import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, AfterLoad } from 'typeorm';
import { Hotel } from '../property/hotel.entity';
import { RoomFeature } from './room-feature.entity';

@Entity()
export class RoomType {
  @PrimaryGeneratedColumn()
  room_type_id!: number;

  @ManyToOne(() => Hotel, hotel => hotel.rooms, { onDelete: 'CASCADE' })
  property!: Hotel;

  @Column({ length: 50 })
  room_type_name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  room_type_base_price!: number;

  @Column({ type: 'text', nullable: true })
  room_type_description!: string;

  @Column()
  room_type_max_capacity!: number;

  @Column()
  available_rooms!: number;
  @Column()
  total_rooms!: number;

  @Column({ type: 'text', nullable: true })
  markup_file_location!: string;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
  
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2,
    nullable: true,
    select: false, // Don't select by default
    insert: false, // Don't try to insert
    update: false  // Don't try to update
  })
  totalPrice?: number;

  @AfterLoad()
  calculateTotalPrice() {
    if (this.features && this.features.length > 0) {
      this.totalPrice = this.room_type_base_price + 
        this.features.reduce((sum, feature) => sum + feature.extraCharge, 0);
    } else {
      this.totalPrice = this.room_type_base_price;
    }
  }
  // @OneToMany(() => RoomTypeImage, image => image.roomType)
  // images!: RoomTypeImage[];

  @OneToMany(() => RoomFeature, feature => feature.roomType)
  features!: RoomFeature[];
}
