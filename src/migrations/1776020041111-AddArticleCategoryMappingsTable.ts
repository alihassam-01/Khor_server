import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArticleCategoryMappingsTable1776020041111 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "article_category_mappings" ("id" SERIAL NOT NULL, "article_id" integer NOT NULL, "category_id" integer NOT NULL, CONSTRAINT "PK_article_category_mappings" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "article_category_mappings" ADD CONSTRAINT "FK_article_category_mappings_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "article_category_mappings" ADD CONSTRAINT "FK_article_category_mappings_category" FOREIGN KEY ("category_id") REFERENCES "location_categories"("category_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "article_category_mappings" DROP CONSTRAINT "FK_article_category_mappings_category"`);
        await queryRunner.query(`ALTER TABLE "article_category_mappings" DROP CONSTRAINT "FK_article_category_mappings_article"`);
        await queryRunner.query(`DROP TABLE "article_category_mappings"`);
    }

}
