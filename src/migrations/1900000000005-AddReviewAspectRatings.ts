import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewAspectRatings1900000000005 implements MigrationInterface {
    name = "AddReviewAspectRatings1900000000005";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "reviews"
            ADD COLUMN IF NOT EXISTS "aspect_ratings" jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "reviews"
            DROP COLUMN IF EXISTS "aspect_ratings"
        `);
    }
}
