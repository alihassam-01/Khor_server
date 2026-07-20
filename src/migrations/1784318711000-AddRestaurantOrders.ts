import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRestaurantOrders1784318711000 implements MigrationInterface {
    name = 'AddRestaurantOrders1784318711000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_orders" CASCADE`);
        await queryRunner.query(`
            CREATE TABLE "restaurant_orders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "restaurant_id" uuid NOT NULL,
                "guest_user_id" uuid NOT NULL,
                "order_text" text NOT NULL,
                "requested_time" TIMESTAMP WITH TIME ZONE NOT NULL,
                "status" character varying(50) NOT NULL DEFAULT 'pending',
                "price_amount" numeric(10,2),
                "bill_item_id" uuid,
                "rejection_reason" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "REL_restaurant_orders_bill_item" UNIQUE ("bill_item_id"),
                CONSTRAINT "PK_restaurant_orders" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_restaurant_orders_booking" ON "restaurant_orders" ("booking_id") `);
        await queryRunner.query(`CREATE INDEX "idx_restaurant_orders_restaurant" ON "restaurant_orders" ("restaurant_id") `);
        await queryRunner.query(`CREATE INDEX "idx_restaurant_orders_status" ON "restaurant_orders" ("status") `);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_restaurant" FOREIGN KEY ("restaurant_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_guest" FOREIGN KEY ("guest_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_bill_item" FOREIGN KEY ("bill_item_id") REFERENCES "booking_bill_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT "FK_restaurant_orders_bill_item"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT "FK_restaurant_orders_guest"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT "FK_restaurant_orders_restaurant"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT "FK_restaurant_orders_booking"`);
        await queryRunner.query(`DROP INDEX "idx_restaurant_orders_status"`);
        await queryRunner.query(`DROP INDEX "idx_restaurant_orders_restaurant"`);
        await queryRunner.query(`DROP INDEX "idx_restaurant_orders_booking"`);
        await queryRunner.query(`DROP TABLE "restaurant_orders"`);
    }
}
