import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVendorSubscriptionPayments1784217367771 implements MigrationInterface {
    name = 'AddVendorSubscriptionPayments1784217367771'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "vendor_subscription_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendor_id" uuid NOT NULL, "subscription_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "period_month" integer NOT NULL, "period_year" integer NOT NULL, "payment_date" TIMESTAMP WITH TIME ZONE, "notes" text, "recorded_by_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1819150d50ce54a47c61fe09eab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_vendor_sub_payments_period" ON "vendor_subscription_payments" ("period_year", "period_month")`);
        await queryRunner.query(`CREATE INDEX "idx_vendor_sub_payments_vendor" ON "vendor_subscription_payments" ("vendor_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_vendor_sub_payments_vendor"`);
        await queryRunner.query(`DROP INDEX "public"."idx_vendor_sub_payments_period"`);
        await queryRunner.query(`DROP TABLE "vendor_subscription_payments"`);
    }
}
