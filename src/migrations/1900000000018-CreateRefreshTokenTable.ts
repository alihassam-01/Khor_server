import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefreshTokenTable1900000000018 implements MigrationInterface {
    name = "CreateRefreshTokenTable1900000000018";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "refresh_token" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "family_id" uuid NOT NULL,
                "token_hash" varchar(64) NOT NULL,
                "expires_at" TIMESTAMPTZ NOT NULL,
                "revoked_at" TIMESTAMPTZ,
                "replaced_by_token_id" uuid,
                "last_used_at" TIMESTAMPTZ,
                "created_by_ip" varchar(64),
                "user_agent" varchar(512),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_refresh_token_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_refresh_token_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_refresh_token_user_id" ON "refresh_token" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_refresh_token_family_id" ON "refresh_token" ("family_id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_token_token_hash" ON "refresh_token" ("token_hash")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_token_token_hash"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_token_family_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_token_user_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "refresh_token"`);
    }
}
