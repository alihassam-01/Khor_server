// import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn } from 'typeorm';
// import { PackageStatus} from '../ENUM/enum';
// import { Duration } from "./duration.entity"
// import { PackageLocation, PackageDiscount } from '@entity/package';
// import { Meal } from '@entity/meal/meal.entity';
// import { Review } from '@entity/review/review.entity';
// import { Vendor } from '../business/vendor-entity';

// @Entity()
// export class Package {
//   @PrimaryGeneratedColumn()
//   package_id!: number;

//   @ManyToOne(() => Vendor, vendor => vendor.packages, { onDelete: 'CASCADE' })
//   @JoinColumn({ name: 'vendor_id' })
//   vendor!: Vendor;

//   @Column({ length: 100 })
//   package_name!: string;

//   @Column({ type: 'date', default: () => 'CURRENT_DATE' })
//   package_created_date!: string;

//   @Column()
//   package_valid_to_date!: string;

//   @Column({ type: 'enum', enum: PackageStatus, default: PackageStatus.UNVERIFIED })
//   package_status!: PackageStatus;

//   @Column({ default: 0 })
//   total_package_bookings!: number;

//   @Column({ type: 'text', nullable: true })
//   markup_file_location!: string;

//   @Column()
//   total_people!: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
//   max_discount_amount!: number;

//   @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
//   total_price!: number;

//   @Column({ default: false })
//   is_deleted!: boolean;

//   @CreateDateColumn()
//   created_at!: Date;

//   @UpdateDateColumn()
//   updated_at!: Date;

//   @OneToOne(() => Duration, duration => duration.package)
//   duration!: Duration;

//   @OneToMany(() => PackageDiscount, pd => pd.package)
//   discounts!: PackageDiscount[];

//   @OneToMany(() => PackageLocation, pl => pl.package)
//   locations!: PackageLocation[];

//   @OneToMany(() => Meal, meal => meal.package)
//   meals!: Meal[];

//   @OneToMany(() => Review, review => review.package)
//   reviews!: Review[];
// }
