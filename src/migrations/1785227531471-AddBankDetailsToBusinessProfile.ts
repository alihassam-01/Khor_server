import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBankDetailsToBusinessProfile1785227531471 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "bank_name" character varying(150)`);
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "bank_account_iban" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "bank_account_title" character varying(150)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "bank_account_title"`);
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "bank_account_iban"`);
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "bank_name"`);
    }

}
