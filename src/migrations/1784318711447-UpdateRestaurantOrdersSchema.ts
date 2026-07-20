import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRestaurantOrdersSchema1784318711447 implements MigrationInterface {
    name = 'UpdateRestaurantOrdersSchema1784318711447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop existing FKs that we will replace or remove
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT IF EXISTS "FK_restaurant_orders_booking"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT IF EXISTS "FK_restaurant_orders_guest"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP CONSTRAINT IF EXISTS "FK_restaurant_orders_bill_item"`);
        
        // 2. Add new columns
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "vendor_id" uuid`);
        
        // Backfill vendor_id for existing records
        await queryRunner.query(`
            UPDATE "restaurant_orders" ro
            SET "vendor_id" = l."vendor_id"
            FROM "listings" l
            WHERE ro."restaurant_id" = l."id"
        `);
        // If there are orphaned records, we could set a dummy vendor_id or delete them, but let's just make it NOT NULL safely.
        await queryRunner.query(`DELETE FROM "restaurant_orders" WHERE "vendor_id" IS NULL`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ALTER COLUMN "vendor_id" SET NOT NULL`);

        // Backfill source and items so we can set NOT NULL
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "source" character varying(50) DEFAULT 'manual'`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ALTER COLUMN "source" DROP DEFAULT`);
        
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "customer_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "customer_phone" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "notes" text`);
        
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "items" jsonb DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ALTER COLUMN "items" DROP DEFAULT`);
        
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "total_amount" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "requested_for" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "served_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "created_by_vendor_user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "created_by_guest_user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD COLUMN IF NOT EXISTS "booking_bill_item_id" uuid`);

        // Update status for legacy orders
        await queryRunner.query(`UPDATE "restaurant_orders" SET "status" = 'confirmed' WHERE "status" = 'accepted'`);
        await queryRunner.query(`UPDATE "restaurant_orders" SET "status" = 'cancelled' WHERE "status" = 'rejected'`);
        await queryRunner.query(`UPDATE "restaurant_orders" SET "status" = 'served' WHERE "status" = 'fulfilled'`);

        // Modify existing columns
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ALTER COLUMN "booking_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ALTER COLUMN "guest_user_id" DROP NOT NULL`);

        // Indexes
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "UQ_restaurant_orders_bill_item_id" UNIQUE ("booking_bill_item_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_restaurant_orders_vendor" ON "restaurant_orders" ("vendor_id") `);

        // Cleanup duplicate listings before applying uniqueness constraint
        await queryRunner.query(`
            UPDATE "listings" l1
            SET "deleted_at" = NOW()
            WHERE "deleted_at" IS NULL
            AND "id" NOT IN (
                SELECT CAST(MIN(CAST("id" AS varchar)) AS uuid)
                FROM "listings" l2 
                WHERE l2."vendor_id" = l1."vendor_id" 
                AND l2."type" = l1."type" 
                AND l2."deleted_at" IS NULL
                GROUP BY l2."vendor_id", l2."type"
            )
        `);

        // Listing Uniqueness
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_listings_vendor_type" ON "listings" ("vendor_id", "type") WHERE deleted_at IS NULL`);

        // Foreign keys
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_vendor" FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_guest" FOREIGN KEY ("guest_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_created_by_vendor" FOREIGN KEY ("created_by_vendor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_created_by_guest" FOREIGN KEY ("created_by_guest_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" ADD CONSTRAINT "FK_restaurant_orders_bill_item" FOREIGN KEY ("booking_bill_item_id") REFERENCES "booking_bill_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // 3. Finally drop old columns
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "requested_time"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "price_amount"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "bill_item_id"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "order_text"`);
        await queryRunner.query(`ALTER TABLE "restaurant_orders" DROP COLUMN IF EXISTS "rejection_reason"`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Down migration can be minimal as this is additive/destructive forward
    }
}
