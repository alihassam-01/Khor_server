import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAdAnalyticsTable1776611273000 implements MigrationInterface {
    name = 'CreateAdAnalyticsTable1776611273000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enums for analytics
        await queryRunner.query(`CREATE TYPE "ad_analytics_ad_type_enum" AS ENUM('hotel', 'restaurant')`);
        await queryRunner.query(`CREATE TYPE "ad_analytics_event_type_enum" AS ENUM('view', 'click')`);
        
        // Create table
        await queryRunner.query(`
            CREATE TABLE "ad_analytics" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ad_id" character varying(255) NOT NULL,
                "ad_type" "ad_analytics_ad_type_enum" NOT NULL,
                "event_type" "ad_analytics_event_type_enum" NOT NULL,
                "ip_hash" character varying(255),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_AD_ANALYTICS" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for high-performance querying
        await queryRunner.query(`CREATE INDEX "IDX_AD_ANALYTICS_AD_ID" ON "ad_analytics" ("ad_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_AD_ANALYTICS_CREATED_AT" ON "ad_analytics" ("created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_AD_ANALYTICS_CREATED_AT"`);
        await queryRunner.query(`DROP INDEX "IDX_AD_ANALYTICS_AD_ID"`);
        await queryRunner.query(`DROP TABLE "ad_analytics"`);
        await queryRunner.query(`DROP TYPE "ad_analytics_event_type_enum"`);
        await queryRunner.query(`DROP TYPE "ad_analytics_ad_type_enum"`);
    }
}
