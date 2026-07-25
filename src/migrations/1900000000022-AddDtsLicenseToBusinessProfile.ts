import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDtsLicenseToBusinessProfile1900000000022 implements MigrationInterface {
    name = 'AddDtsLicenseToBusinessProfile1900000000022'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "dts_license_number" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "dts_license_number"`);
    }
}
