import { Column, Entity,PrimaryGeneratedColumn } from "typeorm";
// import { RoomType } from "./room-type.entity";

@Entity()
export class RoomFeature {
  @PrimaryGeneratedColumn()
  id!: number;

//   @ManyToOne(() => RoomType, roomType => roomType.features)
//   roomType!: RoomType;

  @Column()
  name!: string; // "Mountain View" or "King Bed"

  @Column('decimal', { precision: 10, scale: 2 })
  extraCharge!: number; // 500

  @Column()
  isPrimaryFeature!: boolean; // Marks features that define a "sub-type"
}