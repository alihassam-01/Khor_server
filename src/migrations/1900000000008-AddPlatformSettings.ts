import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlatformSettings1900000000008 implements MigrationInterface {
    name = "AddPlatformSettings1900000000008";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "platform_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "setting_key" character varying(120) NOT NULL,
                "setting_value" text NOT NULL,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_platform_settings_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_platform_settings_key" UNIQUE ("setting_key")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
    }
}
