import { MigrationInterface, QueryRunner } from "typeorm";

export class GenerateLegacySubscriptionPayments1784279473909 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Find all vendor subscriptions that have a paid_at date but no matching payment in vendor_subscription_payments
        // and insert a 'paid' record for them.
        await queryRunner.query(`
            INSERT INTO vendor_subscription_payments (
                vendor_id, 
                subscription_id, 
                amount, 
                status, 
                period_month, 
                period_year, 
                payment_date, 
                notes
            )
            SELECT 
                vs.vendor_id, 
                vs.id, 
                0, -- Legacy payments don't have known amounts from the dropped table
                'paid', 
                EXTRACT(MONTH FROM vs.paid_at), 
                EXTRACT(YEAR FROM vs.paid_at), 
                vs.paid_at, 
                'Legacy payment migrated from property subscriptions'
            FROM vendor_subscriptions vs
            WHERE vs.paid_at IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM vendor_subscription_payments vsp
                WHERE vsp.vendor_id = vs.vendor_id
                AND vsp.period_month = EXTRACT(MONTH FROM vs.paid_at)
                AND vsp.period_year = EXTRACT(YEAR FROM vs.paid_at)
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Delete the legacy payments we just inserted
        await queryRunner.query(`
            DELETE FROM vendor_subscription_payments
            WHERE notes = 'Legacy payment migrated from property subscriptions'
        `);
    }
}
