import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUniqueConstraintArticleLocation1776021700530 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "REL_b36526f80f53c410d4588791d3"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "articles" ADD CONSTRAINT "REL_b36526f80f53c410d4588791d3" UNIQUE ("location_id")`);
    }
}
