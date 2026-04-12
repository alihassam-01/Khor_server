import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Article } from "./article.entity";
import { LocationCategory } from "../location/location-category.entity";

@Entity("article_category_mappings")
export class ArticleCategoryMapping {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  article_id!: number;

  @Column()
  category_id!: number;

  @ManyToOne(() => Article, (article) => article.categoryMappings, { onDelete: "CASCADE" })
  @JoinColumn({ name: "article_id" })
  article!: Article;

  @ManyToOne(() => LocationCategory, { onDelete: "CASCADE" })
  @JoinColumn({ name: "category_id" })
  category!: LocationCategory;
}
