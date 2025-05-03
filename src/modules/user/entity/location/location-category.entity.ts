import {

Entity,
PrimaryGeneratedColumn,
Column,
ManyToOne,
JoinColumn,
CreateDateColumn,
OneToMany,
} from 'typeorm';
import { LocationCategoryMapping } from './location-category-mapping.entity';

@Entity('location_categories')
export class LocationCategory {
@PrimaryGeneratedColumn({ name: 'category_id' })
categoryId!: number;

@Column({ type: 'varchar', length: 100, nullable: false })
name!: string;

@Column({ type: 'varchar', length: 100, nullable: false, unique: true })
slug!: string;

@Column({ type: 'text', nullable: true })
description!: string;

@ManyToOne(() => LocationCategory, (category) => category.categoryId, {
    nullable: true,
    onDelete: 'SET NULL',
})
@JoinColumn({ name: 'parent_category_id' })
parentCategory!: LocationCategory;

@OneToMany(() => LocationCategoryMapping, (mapping) => mapping.category)
categoryMappings!: LocationCategoryMapping[];

@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
createdAt!: Date;
}