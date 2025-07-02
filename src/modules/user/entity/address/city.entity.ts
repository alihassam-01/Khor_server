import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
// import { Locality } from "./locality.entity";


@Entity('city')
export class City {
  @PrimaryGeneratedColumn()
  city_id!: number;

  @Column('varchar', { length: 100, nullable: false })
  name!: string;

  @Column('varchar', { length: 100, default: 'Pakistan' })
  country!: string;

  @Column('decimal', { precision: 10, scale: 8, nullable: true })
  latitude!: number;

  @Column('decimal', { precision: 11, scale: 8, nullable: true })
  longitude!: number;

  // @OneToMany(() => Locality, locality => locality.city)
  // localities!: Locality[];
}