// Purpose: Stores flexible, additional information about places that doesn't fit neatly into the main places table structure.
// e.g., attribute_id 1, location_id 1, attribute_key "population", attribute_value "1000000"
import { Location } from './location.entity';
import {

Entity,
PrimaryGeneratedColumn,
Column,
CreateDateColumn,
UpdateDateColumn,
ManyToOne,
Index,
JoinColumn,
} from 'typeorm';

@Entity('location_attributes')
@Index(['location_id', 'attributeKey'])
export class LocationAttributes {
@PrimaryGeneratedColumn({ name: 'attribute_id' })
attributeId!: number;

@Column({ name: 'location_id' })
location_id!: number;

@ManyToOne(() => Location, (location) => location.attributes, { onDelete: 'CASCADE' })
@JoinColumn({ name: 'location_id' })
place!: Location;


@Column({ name: 'attribute_key', type: 'varchar', length: 100 })
attributeKey!: string;

@Column({ name: 'attribute_value', type: 'text' })
attributeValue!: string;

@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
createdAt!: Date;

@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
updatedAt!: Date;
}