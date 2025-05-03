import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ArticleTag } from './article-tags.entity';

@Entity('tags')
export class Tag {
    @PrimaryGeneratedColumn({ name: 'tag_id' })
    tagId!: number;

    @Column({ type: 'varchar', length: 100, nullable: false })
    name!: string;

    @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
    slug!: string;
    
    @OneToMany(() => ArticleTag, (articleTag) => articleTag.tag, { cascade: true })
    articleTags!: ArticleTag[];

    @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
    createdAt!: Date;
}