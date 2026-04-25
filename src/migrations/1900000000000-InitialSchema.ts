import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Single fresh-schema migration. Replaces the entire previous migration chain.
 *
 * Drops every legacy table that may exist from earlier development (so this
 * can be applied on a partially-migrated dev database) and rebuilds the new
 * schema centred on the unified `listings` model and polymorphic `reviews`.
 *
 * Tables created:
 *   - user, user_profiles, address
 *   - location, location_categories, location_category_mapping,
 *     location_attributes, article_locations
 *   - tags, articles, article_tags, article_category_mappings
 *   - s3_images, audit_logs, subscription_plans, payment_settings
 *   - listings, listing_contacts, listing_media, listing_subscriptions
 *   - hotel_details, restaurant_details, hotel_room_types
 *   - reviews, review_votes
 *   - ad_payments, ad_analytics
 */
export class InitialSchema1900000000000 implements MigrationInterface {
    name = "InitialSchema1900000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---------- extensions ----------
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        // ---------- safety: drop everything that might exist ----------
        await queryRunner.query(`DROP TABLE IF EXISTS "ad_analytics" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "ad_payments" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "review_votes" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "reviews" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_room_types" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "room_type" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_details" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_details" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "listing_subscriptions" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "listing_media" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "listing_contacts" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "listings" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_review" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_reviews" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_review" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurant_reviews" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotels" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurant" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "restaurants" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "media" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "customer_profile" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_profiles" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "city" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "locality" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "address" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "article_tags" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "article_category_mappings" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "article_locations" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "articles" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "tags" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "location_attributes" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "location_category_mapping" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "location_categories" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "location" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payment_settings" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "s3_images" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user" CASCADE`);

        // ---------- enums ----------
        await queryRunner.query(`DROP TYPE IF EXISTS "user_role" CASCADE`);
        await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('customer','travel_agency','vendor','admin')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "subscription_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "subscription_type" AS ENUM ('free','monthly','quarterly','yearly')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "listing_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "listing_type" AS ENUM ('hotel','restaurant','tour','vehicle')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "listing_status" CASCADE`);
        await queryRunner.query(`CREATE TYPE "listing_status" AS ENUM ('draft','pending','active','inactive','expired')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "listing_subscription_status" CASCADE`);
        await queryRunner.query(`CREATE TYPE "listing_subscription_status" AS ENUM ('pending','active','expired','cancelled')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "listing_media_role" CASCADE`);
        await queryRunner.query(`CREATE TYPE "listing_media_role" AS ENUM ('cover','logo','gallery','menu','room')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "review_status" CASCADE`);
        await queryRunner.query(`CREATE TYPE "review_status" AS ENUM ('pending','published','rejected','spam')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "review_target_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "review_target_type" AS ENUM ('listing','room_type','tour_package','article','location')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "payment_status" CASCADE`);
        await queryRunner.query(`CREATE TYPE "payment_status" AS ENUM ('pending','completed','failed','refunded')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "payment_method" CASCADE`);
        await queryRunner.query(`CREATE TYPE "payment_method" AS ENUM ('cash','bank_transfer','easypaisa','jazzcash','credit_card','debit_card')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "analytics_event_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "analytics_event_type" AS ENUM ('view','click')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "location_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "location_type" AS ENUM ('region','city','locality','place')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "room_type" CASCADE`);
        await queryRunner.query(`CREATE TYPE "room_type" AS ENUM ('single','double','suite','deluxe','family')`);

        await queryRunner.query(`DROP TYPE IF EXISTS "audit_log_status" CASCADE`);
        await queryRunner.query(`CREATE TYPE "audit_log_status" AS ENUM ('success','failed')`);

        // ---------- core tables ----------
        await queryRunner.query(`
            CREATE TABLE "user" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "email" varchar NOT NULL UNIQUE,
                "password" varchar,
                "googleId" varchar,
                "authProvider" varchar NOT NULL DEFAULT 'local',
                "userType" "user_role" NOT NULL,
                "verificationToken" varchar,
                "otpExpiresAt" timestamptz,
                "isVerified" boolean NOT NULL DEFAULT false,
                "address_id" int,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                "isActive" boolean NOT NULL DEFAULT true
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "user_profiles" (
                "user_id" uuid PRIMARY KEY,
                "username" varchar(120) NOT NULL,
                "phone_number" varchar(50),
                "profile_picture" text,
                "business_name" varchar(255),
                "is_business_verified" boolean NOT NULL DEFAULT false,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "location" (
                "location_id" SERIAL PRIMARY KEY,
                "name" varchar(255) NOT NULL,
                "plusCode" varchar(20),
                "location_order" int NOT NULL DEFAULT 0,
                "description" text,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "location_type" "location_type" NOT NULL DEFAULT 'place',
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "slug" varchar(100) NOT NULL UNIQUE,
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "parent_location_id" int,
                CONSTRAINT "fk_location_parent" FOREIGN KEY ("parent_location_id") REFERENCES "location"("location_id") ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "location_categories" (
                "category_id" SERIAL PRIMARY KEY,
                "name" varchar(100) NOT NULL,
                "slug" varchar(100) NOT NULL UNIQUE,
                "parent_category_id" int,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_location_categories_parent" FOREIGN KEY ("parent_category_id") REFERENCES "location_categories"("category_id") ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "location_category_mapping" (
                "location_id" int NOT NULL,
                "category_id" int NOT NULL,
                PRIMARY KEY ("location_id","category_id"),
                CONSTRAINT "fk_lcm_location" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE CASCADE,
                CONSTRAINT "fk_lcm_category" FOREIGN KEY ("category_id") REFERENCES "location_categories"("category_id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "location_attributes" (
                "attribute_id" SERIAL PRIMARY KEY,
                "location_id" int NOT NULL,
                "attribute_key" varchar(100) NOT NULL,
                "attribute_value" text NOT NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_location_attr_location" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_location_attr_key" ON "location_attributes"("location_id","attribute_key")`);

        await queryRunner.query(`
            CREATE TABLE "address" (
                "address_id" SERIAL PRIMARY KEY,
                "street_address" text NOT NULL,
                "location_id" int,
                "landmark" varchar(255),
                "is_primary" boolean NOT NULL DEFAULT false,
                CONSTRAINT "fk_address_location" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE SET NULL
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "user"
            ADD CONSTRAINT "fk_user_address" FOREIGN KEY ("address_id") REFERENCES "address"("address_id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            CREATE TABLE "tags" (
                "tag_id" SERIAL PRIMARY KEY,
                "name" varchar(100) NOT NULL,
                "slug" varchar(100) NOT NULL UNIQUE,
                "created_at" timestamp NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "articles" (
                "article_id" SERIAL PRIMARY KEY,
                "title" text NOT NULL,
                "slug" varchar(255) NOT NULL UNIQUE,
                "excerpt" text NOT NULL,
                "image_urls" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "content" text NOT NULL,
                "seo_title" text,
                "seo_description" text,
                "seo_keywords" text,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "published_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "fulltext_index" text NOT NULL DEFAULT '',
                "search_vector" tsvector
            )
        `);
        await queryRunner.query(`
            CREATE TRIGGER trg_articles_search_vector BEFORE INSERT OR UPDATE OF "fulltext_index"
            ON "articles" FOR EACH ROW
            EXECUTE FUNCTION tsvector_update_trigger("search_vector",'pg_catalog.english',"fulltext_index")
        `);
        await queryRunner.query(`CREATE INDEX "idx_articles_search_vector" ON "articles" USING GIN ("search_vector")`);

        await queryRunner.query(`
            CREATE TABLE "article_locations" (
                "article_id" int NOT NULL,
                "location_id" int NOT NULL,
                PRIMARY KEY ("article_id","location_id"),
                CONSTRAINT "fk_al_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE CASCADE,
                CONSTRAINT "fk_al_location" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "article_tags" (
                "article_id" int NOT NULL,
                "tag_id" int NOT NULL,
                PRIMARY KEY ("article_id","tag_id"),
                CONSTRAINT "fk_at_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE CASCADE,
                CONSTRAINT "fk_at_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("tag_id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "article_category_mappings" (
                "id" SERIAL PRIMARY KEY,
                "article_id" int NOT NULL,
                "category_id" int NOT NULL,
                CONSTRAINT "fk_acm_article" FOREIGN KEY ("article_id") REFERENCES "articles"("article_id") ON DELETE CASCADE,
                CONSTRAINT "fk_acm_category" FOREIGN KEY ("category_id") REFERENCES "location_categories"("category_id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "s3_images" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "key" varchar(255) NOT NULL,
                "url" varchar(255) NOT NULL,
                "dateUploaded" timestamp NOT NULL,
                "hash" varchar(255),
                "isDeleted" boolean NOT NULL
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "subscription_plans" (
                "plan_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "type" "subscription_type" NOT NULL,
                "name" varchar(100) NOT NULL,
                "duration_days" int NOT NULL,
                "price" decimal(10,2) NOT NULL,
                "description" text,
                "features" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "is_popular" boolean NOT NULL DEFAULT false,
                "is_active" boolean NOT NULL DEFAULT true,
                "display_order" int NOT NULL DEFAULT 0,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "payment_settings" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "method" "payment_method" NOT NULL UNIQUE,
                "account_name" varchar(255) NOT NULL,
                "account_number" varchar(255) NOT NULL,
                "bank_name" varchar(255),
                "branch_code" varchar(50),
                "is_active" boolean NOT NULL DEFAULT true,
                "notes" text,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "event_type" varchar(100) NOT NULL,
                "recipient" varchar(255) NOT NULL,
                "status" "audit_log_status" NOT NULL DEFAULT 'success',
                "error_message" text,
                "metadata" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_audit_event_type" ON "audit_logs"("event_type")`);
        await queryRunner.query(`CREATE INDEX "idx_audit_recipient" ON "audit_logs"("recipient")`);
        await queryRunner.query(`CREATE INDEX "idx_audit_created_at" ON "audit_logs"("created_at")`);

        // ---------- listing tables ----------
        await queryRunner.query(`
            CREATE TABLE "listings" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "type" "listing_type" NOT NULL,
                "slug" varchar(160) UNIQUE,
                "name" varchar(255) NOT NULL,
                "description" text NOT NULL DEFAULT '',
                "price_from" decimal(10,2) NOT NULL DEFAULT 0,
                "status" "listing_status" NOT NULL DEFAULT 'pending',
                "is_active" boolean NOT NULL DEFAULT false,
                "is_featured" boolean NOT NULL DEFAULT false,
                "is_verified" boolean NOT NULL DEFAULT false,
                "rating_avg" decimal(3,2) NOT NULL DEFAULT 0,
                "rating_count" int NOT NULL DEFAULT 0,
                "view_count" int NOT NULL DEFAULT 0,
                "latitude" decimal(10,7),
                "longitude" decimal(10,7),
                "amenities" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "vendor_id" uuid,
                "location_id" int NOT NULL,
                "fulltext_index" text NOT NULL DEFAULT '',
                "search_vector" tsvector,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                "deleted_at" timestamptz,
                CONSTRAINT "fk_listings_vendor" FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_listings_location" FOREIGN KEY ("location_id") REFERENCES "location"("location_id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_listings_type_status_loc" ON "listings"("type","status","location_id")`);
        await queryRunner.query(`CREATE INDEX "idx_listings_vendor" ON "listings"("vendor_id")`);
        await queryRunner.query(`CREATE INDEX "idx_listings_featured" ON "listings"("is_featured","status","location_id")`);
        await queryRunner.query(`CREATE INDEX "idx_listings_search_vector" ON "listings" USING GIN ("search_vector")`);
        await queryRunner.query(`
            CREATE TRIGGER trg_listings_search_vector BEFORE INSERT OR UPDATE OF "fulltext_index"
            ON "listings" FOR EACH ROW
            EXECUTE FUNCTION tsvector_update_trigger("search_vector",'pg_catalog.english',"fulltext_index")
        `);

        await queryRunner.query(`
            CREATE TABLE "listing_contacts" (
                "listing_id" uuid PRIMARY KEY,
                "phone" varchar(50),
                "whatsapp" varchar(50),
                "facebook" varchar(255),
                "instagram" varchar(255),
                "website" varchar(255),
                "map_link" text,
                "address" text,
                CONSTRAINT "fk_listing_contacts_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "hotel_details" (
                "listing_id" uuid PRIMARY KEY,
                "star_rating" smallint,
                "check_in_time" varchar(8),
                "check_out_time" varchar(8),
                "cancellation_policy" text,
                CONSTRAINT "fk_hotel_details_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "restaurant_details" (
                "listing_id" uuid PRIMARY KEY,
                "cuisines" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "price_per_person" decimal(10,2),
                "opening_hours" jsonb,
                CONSTRAINT "fk_restaurant_details_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "hotel_room_types" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "name" varchar(255) NOT NULL,
                "description" text,
                "type" "room_type",
                "price" decimal(10,2) NOT NULL,
                "amenities" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "capacity" int NOT NULL DEFAULT 1,
                "total_rooms" int NOT NULL DEFAULT 1,
                "images" text[] NOT NULL DEFAULT ARRAY[]::text[],
                "size_sqm" decimal(10,2),
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_room_types_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_room_types_listing" ON "hotel_room_types"("listing_id")`);

        await queryRunner.query(`
            CREATE TABLE "listing_media" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "role" "listing_media_role" NOT NULL DEFAULT 'gallery',
                "url" text NOT NULL,
                "s3_image_id" uuid,
                "room_type_id" uuid,
                "display_order" int NOT NULL DEFAULT 0,
                "alt_text" text,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_listing_media_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_listing_media_s3" FOREIGN KEY ("s3_image_id") REFERENCES "s3_images"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_listing_media_listing_role" ON "listing_media"("listing_id","role")`);

        await queryRunner.query(`
            CREATE TABLE "listing_subscriptions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "plan_id" uuid,
                "subscription_type" "subscription_type" NOT NULL DEFAULT 'free',
                "status" "listing_subscription_status" NOT NULL DEFAULT 'pending',
                "is_featured" boolean NOT NULL DEFAULT false,
                "amount" decimal(10,2) NOT NULL DEFAULT 0,
                "is_paid" boolean NOT NULL DEFAULT false,
                "payment_id" uuid,
                "started_at" timestamptz,
                "expires_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_listing_sub_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_listing_sub_plan" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("plan_id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_listing_sub_listing_status" ON "listing_subscriptions"("listing_id","status")`);
        await queryRunner.query(`CREATE INDEX "idx_listing_sub_expires" ON "listing_subscriptions"("expires_at")`);

        // ---------- reviews ----------
        await queryRunner.query(`
            CREATE TABLE "reviews" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "target_type" "review_target_type" NOT NULL,
                "target_id" varchar(64) NOT NULL,
                "rating" smallint NOT NULL,
                "title" varchar(255),
                "content" text NOT NULL,
                "status" "review_status" NOT NULL DEFAULT 'pending',
                "is_verified_booking" boolean NOT NULL DEFAULT false,
                "helpful_count" int NOT NULL DEFAULT 0,
                "not_helpful_count" int NOT NULL DEFAULT 0,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_reviews_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "uq_reviews_user_target" UNIQUE ("user_id","target_type","target_id"),
                CONSTRAINT "ck_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5)
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_reviews_target_status" ON "reviews"("target_type","target_id","status","created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_reviews_user" ON "reviews"("user_id")`);

        await queryRunner.query(`
            CREATE TABLE "review_votes" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "review_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "is_helpful" boolean NOT NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_review_votes_review" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_review_votes_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "uq_review_votes_review_user" UNIQUE ("review_id","user_id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_review_votes_user" ON "review_votes"("user_id")`);

        // ---------- ad payments / analytics ----------
        await queryRunner.query(`
            CREATE TABLE "ad_payments" (
                "payment_id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "subscription_id" uuid,
                "vendor_id" uuid NOT NULL,
                "amount" decimal(10,2) NOT NULL,
                "payment_status" "payment_status" NOT NULL DEFAULT 'pending',
                "payment_method" "payment_method",
                "transaction_id" varchar(255),
                "notes" text,
                "receipt_url" varchar(255),
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_ad_payments_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_ad_payments_sub" FOREIGN KEY ("subscription_id") REFERENCES "listing_subscriptions"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_ad_payments_vendor" FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_ad_payments_listing" ON "ad_payments"("listing_id")`);
        await queryRunner.query(`CREATE INDEX "idx_ad_payments_vendor" ON "ad_payments"("vendor_id")`);
        await queryRunner.query(`CREATE INDEX "idx_ad_payments_status" ON "ad_payments"("payment_status")`);

        await queryRunner.query(`
            CREATE TABLE "ad_analytics" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "listing_type" "listing_type" NOT NULL,
                "event_type" "analytics_event_type" NOT NULL,
                "ip_hash" varchar(255),
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_ad_analytics_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_ad_analytics_listing_event" ON "ad_analytics"("listing_id","event_type","created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_ad_analytics_type_event" ON "ad_analytics"("listing_type","event_type","created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = [
            "ad_analytics", "ad_payments", "review_votes", "reviews",
            "listing_subscriptions", "listing_media", "hotel_room_types",
            "restaurant_details", "hotel_details", "listing_contacts",
            "listings", "audit_logs", "payment_settings", "subscription_plans",
            "s3_images", "article_category_mappings", "article_tags",
            "article_locations", "articles", "tags",
            "location_attributes", "location_category_mapping", "location_categories",
            "address", "location", "user_profiles", "user",
        ];
        for (const t of tables) {
            await queryRunner.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
        }

        const types = [
            "audit_log_status", "room_type", "location_type", "analytics_event_type",
            "payment_method", "payment_status", "review_target_type", "review_status",
            "listing_media_role", "listing_subscription_status", "listing_status",
            "listing_type", "subscription_type", "user_role",
        ];
        for (const e of types) {
            await queryRunner.query(`DROP TYPE IF EXISTS "${e}" CASCADE`);
        }
    }
}
