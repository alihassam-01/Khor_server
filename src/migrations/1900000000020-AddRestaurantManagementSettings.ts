import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRestaurantManagementSettings1900000000020 implements MigrationInterface {
    name = "AddRestaurantManagementSettings1900000000020";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "allow_online_orders" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "allow_table_bookings" boolean NOT NULL DEFAULT false
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "accepting_orders_now" boolean NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "accepting_reservations_now" boolean NOT NULL DEFAULT true
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "ordering_notes" text
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            ADD COLUMN IF NOT EXISTS "reservation_notes" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "reservation_notes"
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "ordering_notes"
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "accepting_reservations_now"
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "accepting_orders_now"
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "allow_table_bookings"
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurant_details"
            DROP COLUMN IF EXISTS "allow_online_orders"
        `);
    }
}
