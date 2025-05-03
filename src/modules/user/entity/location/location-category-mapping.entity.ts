import { Location } from './location.entity';
import { LocationCategory } from './location-category.entity';

import {
Entity,
PrimaryColumn,
ManyToOne,
JoinColumn,
} from 'typeorm';

@Entity('location_category_mapping')
export class LocationCategoryMapping {
@PrimaryColumn()
location_id!: number;

@PrimaryColumn()
category_id!: number;

@ManyToOne(() => Location, (location) => location.categoryMappings, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'location_id' })
location!: Location;


@ManyToOne(() => LocationCategory, (category) => category.categoryMappings, {
  onDelete: 'CASCADE',
})
@JoinColumn({ name: 'category_id' })
category!: LocationCategory;

}