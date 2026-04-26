-- =====================================
-- KHOR Admin User Setup Script
-- =====================================
-- 
-- Usage: psql -U postgres -d khor_db -f scripts/add-admin.sql
--
-- Default credentials:
-- Email: info@gokhor.com
-- Password: Admin@2026
-- 
-- WARNING: Change the password immediately after first login!
-- =====================================

-- Step 1: Add 'admin' to UserType enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'admin' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_usertype_enum')
    ) THEN
        ALTER TYPE "user_usertype_enum" ADD VALUE 'admin';
        RAISE NOTICE '[SUCCESS] Added admin to UserType enum';
    ELSE
        RAISE NOTICE '[INFO] Admin already exists in UserType enum';
    END IF;
END $$;

-- Step 2: Insert admin user
-- Password hash for: Admin@2026
INSERT INTO "user" (
    id,
    email,
    password,
    "userType",
    "verificationToken",
    "isVerified",
    "isActive",
    "createdAt"
) VALUES (
    gen_random_uuid(),
    'info@gokhor.com',
    '$2b$10$Qnx36IMTadY.f1.haGY2VOBsJPgd.uzuNcS4ADxkL3gF6bhU6m3Bq',
    'admin',
    NULL,
    true,
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    "userType" = EXCLUDED."userType",
    "isVerified" = EXCLUDED."isVerified",
    "isActive" = EXCLUDED."isActive";

-- Step 3: Verify admin user was created
DO $$
DECLARE
    admin_record RECORD;
BEGIN
    SELECT id, email, "userType", "isVerified", "isActive"
    INTO admin_record
    FROM "user"
    WHERE email = 'info@gokhor.com';
    
    IF FOUND THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '[SUCCESS] Admin user created successfully!';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'ID: %', admin_record.id;
        RAISE NOTICE 'Email: %', admin_record.email;
        RAISE NOTICE 'User Type: %', admin_record."userType";
        RAISE NOTICE 'Verified: %', admin_record."isVerified";
        RAISE NOTICE 'Active: %', admin_record."isActive";
        RAISE NOTICE '========================================';
        RAISE NOTICE '[PASSWORD] Default Password: Admin@2026';
        RAISE NOTICE '[WARNING] CHANGE PASSWORD IMMEDIATELY!';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION 'Failed to create admin user';
    END IF;
END $$;