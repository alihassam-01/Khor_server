import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtpExpiresAtToUser1775000000000 implements MigrationInterface {
    name = 'AddOtpExpiresAtToUser1775000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "otpExpiresAt"`);
    }
}
