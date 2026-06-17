import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBusinessDocumentsAndPolicyAcceptances1900000000015 implements MigrationInterface {
    name = "AddBusinessDocumentsAndPolicyAcceptances1900000000015";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "business_document_type_enum" AS ENUM (
                'cnic_front',
                'cnic_back',
                'ownership_proof',
                'lease_agreement',
                'business_license'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "business_document_status_enum" AS ENUM (
                'pending_upload',
                'uploaded',
                'accepted',
                'rejected',
                'superseded'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "business_documents" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "business_profile_id" uuid NOT NULL,
                "document_type" "business_document_type_enum" NOT NULL,
                "original_file_name" varchar(255) NOT NULL,
                "storage_key" varchar(255) NOT NULL,
                "public_url" text NOT NULL,
                "mime_type" varchar(120) NOT NULL,
                "size_bytes" bigint NOT NULL,
                "status" "business_document_status_enum" NOT NULL DEFAULT 'pending_upload',
                "review_note" text,
                "reviewed_by" uuid,
                "reviewed_at" timestamptz,
                "uploaded_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_business_documents_profile" FOREIGN KEY ("business_profile_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_business_documents_profile" ON "business_documents" ("business_profile_id")`);
        await queryRunner.query(`CREATE INDEX "idx_business_documents_status" ON "business_documents" ("status")`);
        await queryRunner.query(`
            CREATE TABLE "policy_acceptances" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "business_profile_id" uuid NOT NULL,
                "policy_type" varchar(80) NOT NULL,
                "policy_version" varchar(80) NOT NULL,
                "content_hash" varchar(128) NOT NULL,
                "accepted_at" timestamptz NOT NULL,
                "ip_address" varchar(100),
                "user_agent" text,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_policy_acceptance_profile_version" UNIQUE ("business_profile_id", "policy_type", "policy_version"),
                CONSTRAINT "fk_policy_acceptances_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_policy_acceptances_profile" FOREIGN KEY ("business_profile_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_policy_acceptances_user" ON "policy_acceptances" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "idx_policy_acceptances_profile" ON "policy_acceptances" ("business_profile_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_policy_acceptances_profile"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_policy_acceptances_user"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "policy_acceptances"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_documents_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_business_documents_profile"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "business_documents"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "business_document_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "business_document_type_enum"`);
    }
}
