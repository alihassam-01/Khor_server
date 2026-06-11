import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessOnboarding1900000000014 implements MigrationInterface {
    name = "AddBusinessOnboarding1900000000014";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "business_onboarding_status_enum" AS ENUM (
                'draft',
                'submitted',
                'changes_requested',
                'approved',
                'rejected',
                'suspended'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "business_capability_type_enum" AS ENUM (
                'hotel',
                'restaurant',
                'tour',
                'vehicle'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "business_capability_status_enum" AS ENUM (
                'draft',
                'submitted',
                'approved',
                'rejected',
                'suspended'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "business_profiles" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "owner_legal_name" varchar(150),
                "business_name" varchar(255),
                "phone_number" varchar(50),
                "whatsapp_number" varchar(50),
                "city_id" integer,
                "business_address" text,
                "google_maps_url" text,
                "onboarding_status" "business_onboarding_status_enum" NOT NULL DEFAULT 'draft',
                "submitted_at" timestamptz,
                "reviewed_at" timestamptz,
                "reviewed_by" uuid,
                "review_note" text,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_business_profiles_user_id" UNIQUE ("user_id"),
                CONSTRAINT "fk_business_profiles_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_business_profiles_city" FOREIGN KEY ("city_id") REFERENCES "location"("location_id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_business_profiles_user_id" ON "business_profiles" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_business_profiles_phone" ON "business_profiles" ("phone_number")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_business_profiles_status" ON "business_profiles" ("onboarding_status")
        `);
        await queryRunner.query(`
            CREATE TABLE "business_capabilities" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "business_profile_id" uuid NOT NULL,
                "type" "business_capability_type_enum" NOT NULL,
                "status" "business_capability_status_enum" NOT NULL DEFAULT 'draft',
                "review_note" text,
                "approved_by" uuid,
                "approved_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_business_capabilities_profile_type" UNIQUE ("business_profile_id", "type"),
                CONSTRAINT "fk_business_capabilities_profile" FOREIGN KEY ("business_profile_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_business_capabilities_profile" ON "business_capabilities" ("business_profile_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_business_capabilities_status" ON "business_capabilities" ("status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_capabilities_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_capabilities_profile"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "business_capabilities"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_profiles_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_profiles_phone"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_profiles_user_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "business_profiles"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "business_capability_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "business_capability_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "business_onboarding_status_enum"`);
    }
}
