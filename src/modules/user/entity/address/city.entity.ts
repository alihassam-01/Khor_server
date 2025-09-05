import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn } from "typeorm";
import { Location } from "../location";

@Entity('city')
export class City {
  @PrimaryGeneratedColumn()
  city_id!: number;

  @Column('varchar', { length: 100, nullable: false })
  name!: string;

  @Column('varchar', { length: 100, default: 'Pakistan' })
  country!: string;

  @Column({ name: 'location_id', nullable: true })
  location_id!: number;

  @OneToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location!: Location;
}