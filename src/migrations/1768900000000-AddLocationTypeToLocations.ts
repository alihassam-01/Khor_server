import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLocationTypeToLocations1768900000000 implements MigrationInterface {
    name = "AddLocationTypeToLocations1768900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum only once for idempotent deployments.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_namespace n ON n.oid = t.typnamespace
                    WHERE t.typname = 'location_location_type_enum'
                      AND n.nspname = 'public'
                ) THEN
                    CREATE TYPE "public"."location_location_type_enum" AS ENUM ('region', 'city', 'locality', 'place');
                END IF;
            END
            $$;
        `);

        // Support both legacy table names: locations (plural) and location (singular).
        await queryRunner.query(`
            DO $$
            DECLARE
                target_table text;
            BEGIN
                IF to_regclass('public.locations') IS NOT NULL THEN
                    target_table := 'locations';
                ELSIF to_regclass('public.location') IS NOT NULL THEN
                    target_table := 'location';
                ELSE
                    RAISE EXCEPTION 'Neither public.locations nor public.location table exists';
                END IF;

                EXECUTE format(
                    'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS location_type public.location_location_type_enum NOT NULL DEFAULT ''place''',
                    target_table
                );
            END
            $$;
        `);

        // Optional safe backfill: if legacy cities table exists, mark matching rows as city.
        await queryRunner.query(`
            DO $$
            DECLARE
                target_table text;
            BEGIN
                IF to_regclass('public.cities') IS NULL THEN
                    RETURN;
                END IF;

                IF to_regclass('public.locations') IS NOT NULL THEN
                    target_table := 'locations';
                ELSIF to_regclass('public.location') IS NOT NULL THEN
                    target_table := 'location';
                ELSE
                    RETURN;
                END IF;

                EXECUTE format(
                    'UPDATE public.%I l SET location_type = ''city'' FROM public.cities c WHERE c.location_id = l.location_id AND l.location_type = ''place''',
                    target_table
                );
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
                target_table text;
            BEGIN
                IF to_regclass('public.locations') IS NOT NULL THEN
                    target_table := 'locations';
                ELSIF to_regclass('public.location') IS NOT NULL THEN
                    target_table := 'location';
                ELSE
                    RETURN;
                END IF;

                EXECUTE format(
                    'ALTER TABLE public.%I DROP COLUMN IF EXISTS location_type',
                    target_table
                );
            END
            $$;
        `);

        // Drop enum only if no remaining columns still depend on it.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_type t ON t.oid = a.atttypid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE t.typname = 'location_location_type_enum'
                      AND n.nspname = 'public'
                      AND c.relkind IN ('r', 'p')
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                ) THEN
                    DROP TYPE IF EXISTS "public"."location_location_type_enum";
                END IF;
            END
            $$;
        `);
    }
}
