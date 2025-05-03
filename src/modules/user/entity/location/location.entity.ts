import {

Entity,
PrimaryGeneratedColumn,
Column,
CreateDateColumn,
UpdateDateColumn,
OneToMany,
} from 'typeorm';
import { LocationAttributes, LocationCategoryMapping } from '@entity/location';
import { PackageLocation } from '@entity/package';

@Entity('location')
export class Location {
@PrimaryGeneratedColumn()
location_id!: number;

@Column('varchar', { length: 255, nullable: false })
name!: string;

@Column('decimal', { precision: 10, scale: 8 })
latitude!: number;

@Column('decimal', { precision: 11, scale: 8 })
longitude!: number;

@Column('int', { default: 0 })
location_order!: number;

@Column('text', { nullable: true })
description!: string;

@Column('boolean', { default: false })
is_deleted!: boolean;

@CreateDateColumn({ type: 'timestamp' })
created_at!: Date;

@Column({ type: 'varchar', length: 100, nullable: false, unique: true })
slug!: string;

@OneToMany(() => LocationAttributes, attr => attr.place, { cascade: true })
attributes!: LocationAttributes[];

@OneToMany(() => LocationCategoryMapping, LocationCategoryMapping => LocationCategoryMapping.location, { cascade: true })
categoryMappings!: LocationCategoryMapping[];

@OneToMany(() => PackageLocation, pl => pl.location)
  packages!: PackageLocation[];

@UpdateDateColumn({ type: 'timestamp' })
updated_at!: Date;
}