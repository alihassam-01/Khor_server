import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWhatsappBookingEnabled1785023898900 implements MigrationInterface {
    name = 'AddWhatsappBookingEnabled1785023898900'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "whatsapp_booking_enabled" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "whatsapp_booking_enabled"`);
    }
}
