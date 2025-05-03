import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Package } from '../package/package.entity';
import { Property } from '../property/property.entity';


@Entity()
export class Vendor {
  @PrimaryGeneratedColumn()
  vendor_id!: number;

  @Column({ length: 100 })
  vendor_name!: string;

  @Column({ length: 15, unique: true })
  vendor_cnic!: string;

  @Column({ default: false })
  vendor_verified!: boolean;

  @Column({ type: 'text', nullable: true })
  markup_file_location!: string;

  @Column({ default: false })
  is_deleted!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Package, pkg => pkg.vendor)
  packages!: Package[];

  @OneToMany(() => Property, property => property.vendor)
  properties!: Property[];
}
