import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogTable1776613258000 implements MigrationInterface {
    name = 'CreateAuditLogTable1776613258000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum for audit log status
        await queryRunner.query(`CREATE TYPE "audit_logs_status_enum" AS ENUM('success', 'failed')`);

        // Create table
        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "event_type" character varying(100) NOT NULL,
                "recipient" character varying(255) NOT NULL,
                "status" "audit_logs_status_enum" NOT NULL DEFAULT 'success',
                "error_message" text,
                "metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_AUDIT_LOGS" PRIMARY KEY ("id")
            )
        `);

        // Create indexes
        await queryRunner.query(`CREATE INDEX "IDX_AUDIT_LOGS_EVENT_TYPE" ON "audit_logs" ("event_type")`);
        await queryRunner.query(`CREATE INDEX "IDX_AUDIT_LOGS_RECIPIENT" ON "audit_logs" ("recipient")`);
        await queryRunner.query(`CREATE INDEX "IDX_AUDIT_LOGS_CREATED_AT" ON "audit_logs" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_AUDIT_LOGS_CREATED_AT"`);
        await queryRunner.query(`DROP INDEX "IDX_AUDIT_LOGS_RECIPIENT"`);
        await queryRunner.query(`DROP INDEX "IDX_AUDIT_LOGS_EVENT_TYPE"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "audit_logs_status_enum"`);
    }
}
