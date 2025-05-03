import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index,
    OneToMany,
  } from "typeorm";
  import { Location } from "@entity/location"; // Make sure this import is correct
import { ArticleTag } from "./article-tags.entity";
  
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
  
    @Column("text")
    image_url!: string;
  
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
  
    @OneToOne(() => Location, { nullable: true })
    @JoinColumn({ name: "location_id" }) 
    location!: Location | null;

    @OneToMany(() => ArticleTag, (articleTag) => articleTag.article)
articleTags!: ArticleTag[];
  
    @Column("int", { nullable: true })
    location_id!: number | null;

    @Column("text", { select: false })
    @Index("fulltext_index", { fulltext: true })
    fulltext_index!: string;
  }
  