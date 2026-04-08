import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentSettingsTable1775573000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Reuse the existing enum type to avoid conflicts
        await queryRunner.query(`
            CREATE TABLE "payment_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "method" "public"."ad_payments_payment_method_enum" NOT NULL,
                "account_name" character varying(255) NOT NULL,
                "account_number" character varying(255) NOT NULL,
                "bank_name" character varying(255),
                "branch_code" character varying(50),
                "is_active" boolean NOT NULL DEFAULT true,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_payment_settings_method" UNIQUE ("method"),
                CONSTRAINT "PK_payment_settings_id" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "payment_settings"`);
    }
}
