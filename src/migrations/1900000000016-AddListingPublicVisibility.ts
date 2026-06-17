import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListingPublicVisibility1900000000016 implements MigrationInterface {
    name = "AddListingPublicVisibility1900000000016";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "listings"
            ADD COLUMN IF NOT EXISTS "is_public_visible" boolean NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            ALTER TABLE "listings"
            ADD COLUMN IF NOT EXISTS "visibility_note" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "listings"
            DROP COLUMN IF EXISTS "visibility_note"
        `);

        await queryRunner.query(`
            ALTER TABLE "listings"
            DROP COLUMN IF EXISTS "is_public_visible"
        `);
    }
}
