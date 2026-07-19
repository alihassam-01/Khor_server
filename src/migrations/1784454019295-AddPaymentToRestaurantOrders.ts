import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentToRestaurantOrders1784454019295 implements MigrationInterface {
    name = 'AddPaymentToRestaurantOrders1784454019295'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."restaurant_orders_payment_status_enum" AS ENUM('unpaid', 'partial', 'paid')`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD "paid_amount" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD "payment_status" "public"."restaurant_orders_payment_status_enum" NOT NULL DEFAULT 'unpaid'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN "payment_status"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN "paid_amount"`);
        await queryRunner.query(`DROP TYPE "public"."restaurant_orders_payment_status_enum"`);
    }
}
