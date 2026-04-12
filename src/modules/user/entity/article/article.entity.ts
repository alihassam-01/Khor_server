import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Location } from "@modules/user/entity/location";
import { ArticleTag } from "./article-tags.entity";
import { ArticleCategoryMapping } from "./article-category-mapping.entity";

@Entity("articles")
export class Article {
  @PrimaryGeneratedColumn()
  article_id!: number;

  @Column("text")
  title!: string;

  @Column("varchar", { length: 255, unique: true, nullable: false })
  slug!: string;

  @Column("text")
  excerpt!: string;

  @Column("text", { array: true, default: () => "ARRAY[]::text[]" })
  image_urls!: string[];

  @Column("text")
  content!: string;

  @Column("text", { nullable: true })
  seo_title!: string | null;

  @Column("text", { nullable: true })
  seo_description!: string | null;

  @Column("text", { nullable: true })
  seo_keywords!: string | null;

  @Column("boolean", { default: false })
  is_deleted!: boolean;

  @Column("timestamp", { nullable: true })
  published_at!: Date | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at!: Date;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: "location_id" })
  location!: Location | null;

  @OneToMany(() => ArticleTag, (articleTag) => articleTag.article)
  articleTags!: ArticleTag[];

  @OneToMany(() => ArticleCategoryMapping, (mapping) => mapping.article)
  categoryMappings!: ArticleCategoryMapping[];

  @Column("int", { nullable: true })
  location_id!: number | null;

  @Column("text", { select: false })
  fulltext_index!: string;

  @Column("tsvector", { nullable: true, select: false })
  search_vector!: string | null;

  @BeforeInsert()
  @BeforeUpdate()
  setFulltextIndex() {
    this.fulltext_index = [
      this.title || '',
      this.excerpt || '',
      this.content || '',
      this.seo_title || '',
      this.seo_description || '',
      this.seo_keywords || ''
    ].join(' ');
  }
}
