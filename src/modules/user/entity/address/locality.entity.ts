// import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
// import { City } from "./city.entity";
// import { Address } from "./address.entity";

// @Entity('locality')
// export class Locality {
//   @PrimaryGeneratedColumn()
//   locality_id!: number;

//   @Column('varchar', { length: 100, nullable: false })
//   name!: string;

//   @Column('varchar', { length: 20, nullable: true })
//   postal_code!: string;

//   @ManyToOne(() => City, city => city.localities)
//   @JoinColumn({ name: 'city_id' })
//   city!: City;

//   @OneToMany(() => Address, address => address.locality)
//   addresses!: Address[];
// }