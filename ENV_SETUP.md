# Environment Setup Instructions

## Setting Up Feature Flags for Phase 1 Launch

Your application now uses feature flags to control which features are enabled. For Phase 1 (Articles + Locations + Reviews), you need to add these environment variables to your `.env` file.

### Steps:

1. **Open your `.env` file** (if it doesn't exist, create it in the root directory: `f:\GoFunoon\travelBaltistan\Khor-server\.env`)

2. **Add the following Feature Flag variables** to your `.env` file:

```env
# ==========================================
# FEATURE FLAGS - Phase 1: Articles + Locations + Reviews
# ==========================================
FEATURE_ARTICLES=true
FEATURE_LOCATIONS=true
FEATURE_REVIEWS=true
FEATURE_PROPERTIES=false
FEATURE_BOOKINGS=false
FEATURE_TOUR_PACKAGES=false
FEATURE_VEHICLES=false
FEATURE_PAYOUTS=false
FEATURE_REFUNDS=false
FEATURE_LISTING_PRICES=false
FEATURE_TAGS=false
```

3. **Save the file**

4. **Restart your server** (if it's currently running):
   - Stop the server (Ctrl+C)
   - Run: `npm run dev`

### What This Does:

- ✅ **Enables**: Articles, Locations, Reviews, Article Tags, Auth, User Management, Media Uploads
- ❌ **Disables**: Properties, Bookings, Tours, Vehicles, Payouts, Refunds, etc.

When the server starts, you'll see:
```
🚀 Enabled features: articles, locations, reviews
📝 Running in Phase 1 mode (Articles + Locations + Reviews)
```

### To Enable More Features Later:

Simply change any feature flag from `false` to `true` and restart the server. For example, to add locations:

```env
FEATURE_LOCATIONS=true
```

No code changes or database migrations needed!

---

## Complete .env Template

If you're setting up a new environment, here's a complete template. **Replace the placeholder values** with your actual configuration:

```env
# ==========================================
# DATABASE CONFIGURATION
# ==========================================
DATABASE_URL=postgresql://username:password@localhost:5432/khor_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=khor_db

# ==========================================
# SERVER CONFIGURATION
# ==========================================
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# ==========================================
# JWT CONFIGURATION
# ==========================================
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# ==========================================
# FEATURE FLAGS - Phase 1: Articles + Reviews
# ==========================================
FEATURE_ARTICLES=true
FEATURE_REVIEWS=true
FEATURE_PROPERTIES=false
FEATURE_BOOKINGS=false
FEATURE_TOUR_PACKAGES=false
FEATURE_VEHICLES=false
FEATURE_LOCATIONS=false
FEATURE_PAYOUTS=false
FEATURE_REFUNDS=false
FEATURE_LISTING_PRICES=false
FEATURE_TAGS=false

# ==========================================
# AWS S3 / CLOUDFLARE R2 CONFIGURATION
# ==========================================
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=auto
AWS_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
AWS_BUCKET_NAME=your_bucket_name

# ==========================================
# EMAIL SERVICE CONFIGURATION
# ==========================================
EMAIL_SERVICE=brevo
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=noreply@yourdomain.com

# ==========================================
# CORS CONFIGURATION
# ==========================================
CORS_ORIGIN=*
```

### Security Note:
⚠️ **Never commit your `.env` file to version control!** It's already in `.gitignore`.

---

## Verification

After adding the feature flags and restarting:

1. **Check server logs** for the "Enabled features" message
2. **Test articles endpoint**: `GET http://localhost:3000/api/articles`
3. **Verify disabled features return 404**: `GET http://localhost:3000/api/properties`

For more detailed information about feature flags, see [FEATURES.md](file:///f:/GoFunoon/travelBaltistan/Khor-server/FEATURES.md)
