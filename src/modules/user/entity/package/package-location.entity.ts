import { Entity, ManyToOne, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { Package } from './package.entity';
import { Location } from '@entity/location';

@Entity()
export class PackageLocation {
  @PrimaryColumn()
  package_id!: number;

  @PrimaryColumn()
  location_id!: number;

  @ManyToOne(() => Package, pkg => pkg.locations, { onDelete: 'CASCADE' })
  package!: Package;

  @ManyToOne(() => Location, loc => loc.packages, { onDelete: 'CASCADE' })
  location!: Location;

  @CreateDateColumn()
  created_at!: Date;
}
