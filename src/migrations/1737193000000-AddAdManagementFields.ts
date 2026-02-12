import { MigrationInterface, QueryRunner, TableColumn, Table, TableForeignKey } from "typeorm";

export class AddAdManagementFields1737193000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new columns to hotels table
        await queryRunner.addColumns("hotels", [
            new TableColumn({
                name: "vendor_id",
                type: "uuid",
                isNullable: true,
            }),
            new TableColumn({
                name: "expires_at",
                type: "timestamp",
                isNullable: true,
            }),
            new TableColumn({
                name: "subscription_type",
                type: "enum",
                enum: ["free", "monthly", "quarterly", "yearly"],
                default: "'free'",
            }),
            new TableColumn({
                name: "is_paid",
                type: "boolean",
                default: false,
            }),
            new TableColumn({
                name: "is_featured",
                type: "boolean",
                default: false,
            }),
        ]);

        // Add new columns to restaurants table
        await queryRunner.addColumns("restaurants", [
            new TableColumn({
                name: "vendor_id",
                type: "uuid",
                isNullable: true,
            }),
            new TableColumn({
                name: "expires_at",
                type: "timestamp",
                isNullable: true,
            }),
            new TableColumn({
                name: "subscription_type",
                type: "enum",
                enum: ["free", "monthly", "quarterly", "yearly"],
                default: "'free'",
            }),
            new TableColumn({
                name: "is_paid",
                type: "boolean",
                default: false,
            }),
            new TableColumn({
                name: "is_featured",
                type: "boolean",
                default: false,
            }),
        ]);

        // Create ad_payments table
        await queryRunner.createTable(
            new Table({
                name: "ad_payments",
                columns: [
                    {
                        name: "payment_id",
                        type: "uuid",
                        isPrimary: true,
                        generationStrategy: "uuid",
                        default: "uuid_generate_v4()",
                    },
                    {
                        name: "ad_id",
                        type: "uuid",
                    },
                    {
                        name: "ad_type",
                        type: "enum",
                        enum: ["hotel", "restaurant"],
                    },
                    {
                        name: "vendor_id",
                        type: "uuid",
                    },
                    {
                        name: "amount",
                        type: "decimal",
                        precision: 10,
                        scale: 2,
                    },
                    {
                        name: "payment_status",
                        type: "enum",
                        enum: ["pending", "completed", "failed", "refunded"],
                        default: "'pending'",
                    },
                    {
                        name: "payment_method",
                        type: "enum",
                        enum: ["cash", "bank_transfer", "easypaisa", "jazzcash", "credit_card", "debit_card"],
                        isNullable: true,
                    },
                    {
                        name: "transaction_id",
                        type: "varchar",
                        length: "255",
                        isNullable: true,
                    },
                    {
                        name: "notes",
                        type: "text",
                        isNullable: true,
                    },
                    {
                        name: "receipt_url",
                        type: "varchar",
                        length: "255",
                        isNullable: true,
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "CURRENT_TIMESTAMP",
                        onUpdate: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true
        );

        // Add foreign key for hotels.vendor_id
        await queryRunner.createForeignKey(
            "hotels",
            new TableForeignKey({
                columnNames: ["vendor_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "SET NULL",
            })
        );

        // Add foreign key for restaurants.vendor_id
        await queryRunner.createForeignKey(
            "restaurants",
            new TableForeignKey({
                columnNames: ["vendor_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "SET NULL",
            })
        );

        // Add foreign key for ad_payments.vendor_id
        await queryRunner.createForeignKey(
            "ad_payments",
            new TableForeignKey({
                columnNames: ["vendor_id"],
                referencedColumnNames: ["id"],
                referencedTableName: "users",
                onDelete: "CASCADE",
            })
        );

        // Create indexes for better query performance
        await queryRunner.query(`CREATE INDEX "IDX_hotels_vendor_id" ON "hotels" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_hotels_expires_at" ON "hotels" ("expires_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_hotels_is_featured" ON "hotels" ("is_featured")`);

        await queryRunner.query(`CREATE INDEX "IDX_restaurants_vendor_id" ON "restaurants" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_restaurants_expires_at" ON "restaurants" ("expires_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_restaurants_is_featured" ON "restaurants" ("is_featured")`);

        await queryRunner.query(`CREATE INDEX "IDX_ad_payments_vendor_id" ON "ad_payments" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ad_payments_ad_id" ON "ad_payments" ("ad_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_ad_payments_status" ON "ad_payments" ("payment_status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX "IDX_ad_payments_status"`);
        await queryRunner.query(`DROP INDEX "IDX_ad_payments_ad_id"`);
        await queryRunner.query(`DROP INDEX "IDX_ad_payments_vendor_id"`);
        await queryRunner.query(`DROP INDEX "IDX_restaurants_is_featured"`);
        await queryRunner.query(`DROP INDEX "IDX_restaurants_expires_at"`);
        await queryRunner.query(`DROP INDEX "IDX_restaurants_vendor_id"`);
        await queryRunner.query(`DROP INDEX "IDX_hotels_is_featured"`);
        await queryRunner.query(`DROP INDEX "IDX_hotels_expires_at"`);
        await queryRunner.query(`DROP INDEX "IDX_hotels_vendor_id"`);

        // Drop foreign keys
        const hotelsTable = await queryRunner.getTable("hotels");
        const restaurantsTable = await queryRunner.getTable("restaurants");
        const paymentsTable = await queryRunner.getTable("ad_payments");

        if (hotelsTable) {
            const hotelsForeignKey = hotelsTable.foreignKeys.find(
                fk => fk.columnNames.indexOf("vendor_id") !== -1
            );
            if (hotelsForeignKey) {
                await queryRunner.dropForeignKey("hotels", hotelsForeignKey);
            }
        }

        if (restaurantsTable) {
            const restaurantsForeignKey = restaurantsTable.foreignKeys.find(
                fk => fk.columnNames.indexOf("vendor_id") !== -1
            );
            if (restaurantsForeignKey) {
                await queryRunner.dropForeignKey("restaurants", restaurantsForeignKey);
            }
        }

        if (paymentsTable) {
            const paymentsForeignKey = paymentsTable.foreignKeys.find(
                fk => fk.columnNames.indexOf("vendor_id") !== -1
            );
            if (paymentsForeignKey) {
                await queryRunner.dropForeignKey("ad_payments", paymentsForeignKey);
            }
        }

        await queryRunner.dropTable("ad_payments");

        await queryRunner.dropColumns("hotels", [
            "vendor_id",
            "expires_at",
            "subscription_type",
            "is_paid",
            "is_featured",
        ]);

        await queryRunner.dropColumns("restaurants", [
            "vendor_id",
            "expires_at",
            "subscription_type",
            "is_paid",
            "is_featured",
        ]);
    }
}
