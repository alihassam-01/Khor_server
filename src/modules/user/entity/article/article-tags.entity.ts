import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Article } from './article.entity';
import { Tag } from './tags.entity';

@Entity('article_tags')
export class ArticleTag {
    @PrimaryColumn()
    article_id!: number;

    @PrimaryColumn()
    tag_id!: number;

    @ManyToOne(() => Article, (article) => article.articleTags, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'article_id' })
    article!: Article;

    @ManyToOne(() => Tag, (tag) => tag.articleTags, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tag_id' })
    tag!: Tag;
}