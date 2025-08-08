import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('s3_images')
export class S3ImagesEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
    @Column({ type: 'varchar', length: 255, nullable: false })
    key!: string;
    @Column({ type: 'varchar', length: 255, nullable: false })
    url!: string;
    @Column({ type: 'timestamp', nullable: false })
    dateUploaded!: Date;
    @Column({ type: 'boolean' })
    isDeleted!: boolean;
}