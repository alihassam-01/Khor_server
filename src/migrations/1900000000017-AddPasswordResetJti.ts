import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetJti1900000000017 implements MigrationInterface {
    name = "AddPasswordResetJti1900000000017";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS "password_reset_jti_hash" varchar(64)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "user"
            DROP COLUMN IF EXISTS "password_reset_jti_hash"
        `);
    }
}
