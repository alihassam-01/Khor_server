import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrateLegacyRestaurantOrders1784319478027 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Parse listings that have opening_hours->'__restaurant_workspace'->'orders'
        const records = await queryRunner.query(`
            SELECT l.id as restaurant_id, l.vendor_id, rd.opening_hours
            FROM "listings" l
            JOIN "restaurant_details" rd ON rd.listing_id = l.id
            WHERE l.type = 'restaurant' 
              AND rd.opening_hours IS NOT NULL 
              AND rd.opening_hours->'__restaurant_workspace'->'orders' IS NOT NULL
        `);

        for (const row of records) {
            const { restaurant_id, vendor_id, opening_hours } = row;
            const orders = opening_hours?.__restaurant_workspace?.orders || [];

            if (!Array.isArray(orders) || orders.length === 0) continue;

            for (const order of orders) {
                // Ignore if it already exists by ID just in case
                const existing = await queryRunner.query(`SELECT id FROM "restaurant_orders" WHERE id = $1`, [order.id]);
                if (existing.length > 0) continue;

                // Map status
                let newStatus = 'pending';
                if (order.status === 'confirmed') newStatus = 'confirmed';
                else if (order.status === 'cooking') newStatus = 'cooking';
                else if (order.status === 'served') newStatus = 'served';
                else if (order.status === 'cancelled') newStatus = 'cancelled';
                else if (order.status === 'accepted') newStatus = 'confirmed';
                else if (order.status === 'rejected') newStatus = 'cancelled';
                else if (order.status === 'fulfilled') newStatus = 'served';

                const totalAmount = Number(order.totalAmount) || 0;
                
                let bookingId = order.attachedBookingId;
                if (!bookingId || bookingId.trim() === '') bookingId = null;

                const itemsJson = JSON.stringify(order.items || []);

                await queryRunner.query(`
                    INSERT INTO "restaurant_orders" (
                        "id", 
                        "restaurant_id", 
                        "vendor_id", 
                        "booking_id", 
                        "source", 
                        "status", 
                        "customer_name", 
                        "customer_phone", 
                        "notes", 
                        "items", 
                        "total_amount", 
                        "created_at", 
                        "updated_at"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                `, [
                    order.id, // we trust legacy UUID
                    restaurant_id,
                    vendor_id,
                    bookingId,
                    'manual', // legacy orders didn't have online/manual, default manual
                    newStatus,
                    order.customerName || 'Legacy Customer',
                    order.phone || null,
                    order.notes || null,
                    itemsJson,
                    totalAmount,
                    order.createdAt ? new Date(order.createdAt) : new Date(),
                    order.updatedAt ? new Date(order.updatedAt) : new Date()
                ]);
            }
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Not reversible
    }

}
