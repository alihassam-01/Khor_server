# Feature Flags Documentation

## Overview
This application uses feature flags to enable/disable functionality based on deployment phase. All features are controlled via environment variables for easy deployment configuration without code changes.

## Current Phase

**Phase 1: Articles + Locations + Reviews** (Current)
- ✅ Articles
- ✅ Locations (required for articles)
- ✅ Article Tags
- ✅ Reviews
- ✅ Authentication
- ✅ User Management
- ✅ Media Uploads (R2)

## How to Enable/Disable Features

### Environment Variables
All feature flags are controlled via environment variables in your `.env` file:

```env
# Phase 1 Configuration (Default)
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

**To enable a feature:** Set its environment variable to `true`  
**To disable a feature:** Set its environment variable to `false` or omit it

After changing feature flags, restart the server:
```bash
npm run dev  # Development
npm start    # Production
```

## Available Features

| Feature | Environment Variable | Default | Dependencies | Description |
|---------|---------------------|---------|--------------|-------------|
| **Articles** | `FEATURE_ARTICLES` | `true` | None | Blog/content management system |
| **Article Tags** | *Enabled with Articles* | `true` | Articles | Article-specific tagging |
| **Properties** | `FEATURE_PROPERTIES` | `false` | None | Hotel/accommodation listings with room types |
| **Bookings** | `FEATURE_BOOKINGS` | `false` | Properties | Reservation system with payments |
| **Tour Packages** | `FEATURE_TOUR_PACKAGES` | `false` | None | Pre-planned tour offerings |
| **Vehicles** | `FEATURE_VEHICLES` | `false` | None | Vehicle rental services |
| **Locations** | `FEATURE_LOCATIONS` | `true` | None | Destination/place management (required for articles) |
| **Reviews** | `FEATURE_REVIEWS` | `true` | None | User review system |
| **Payouts** | `FEATURE_PAYOUTS` | `false` | Bookings | Vendor payout management |
| **Refunds** | `FEATURE_REFUNDS` | `false` | Bookings | Refund processing |
| **Listing Prices** | `FEATURE_LISTING_PRICES` | `false` | Properties | Dynamic pricing system |
| **Tags** | `FEATURE_TAGS` | `false` | None | Generic tagging system |

> **Note:** Core features like Authentication, User Management, and Media Uploads (R2) are always enabled as they're required by multiple features.

## Phase Rollout Plan

### Phase 1 (Current) - Articles + Locations + Reviews
**Goal:** Launch with blog/content management, location data, and review capabilities

```env
FEATURE_ARTICLES=true
FEATURE_LOCATIONS=true
FEATURE_REVIEWS=true
# All other features disabled
```

**Available Endpoints:**
- `/api/articles` - Article CRUD operations (requires location data)
- `/api/locations` - Location/place management
- `/api/article-tags` - Article tag management
- `/api/reviews` - Review system
- `/api/auth` - Authentication
- `/api/users` - User management

---

### Phase 2 - Add Destinations & Accommodations
**Goal:** Enable travel destination browsing and hotel listings

```env
FEATURE_ARTICLES=true
FEATURE_LOCATIONS=true
FEATURE_PROPERTIES=true
```

**New Endpoints:**
- `/api/locations` - Destinations and places
- `/api/properties` - Hotels and accommodations
- `/api/room-types` - Room type management

---

### Phase 3 - Enable Booking System
**Goal:** Allow users to book accommodations

```env
# Phase 2 settings +
FEATURE_BOOKINGS=true
FEATURE_PAYOUTS=true
FEATURE_REFUNDS=true
FEATURE_LISTING_PRICES=true
```

**New Endpoints:**
- `/api/bookings` - Booking management
- `/api/payouts` - Vendor payouts
- `/api/refunds` - Refund processing
- `/api/listing-prices` - Dynamic pricing

---

### Phase 4 - Add Activities
**Goal:** Expand to tours and vehicle rentals

```env
# Phase 3 settings +
FEATURE_TOUR_PACKAGES=true
FEATURE_VEHICLES=true
FEATURE_REVIEWS=true
```

**New Endpoints:**
- `/api/tour-packages` - Tour package listings
- `/api/vehicles` - Vehicle rentals
- `/api/reviews` - Review system

---

### Full Launch - All Features
Set all feature flags to `true` for complete platform functionality.

## Server Startup Behavior

When the server starts, it logs all enabled features:

```
🚀 Enabled features: articles, locations, reviews
📝 Running in Phase 1 mode (Articles + Locations + Reviews)
```

This confirms which features are active in your current deployment.

## Database Considerations

**Important:** All database tables for all features are always created regardless of feature flags. This approach:
- ✅ Makes re-enabling features instant (no migrations needed)
- ✅ Preserves data if you temporarily disable a feature
- ✅ Simplifies development and testing
- ⚠️ Creates some unused tables in Phase 1

Features are disabled at the **API route level**, not the database level.

## Accessing Disabled Features

When a feature is disabled, its API endpoints are not registered. Attempting to access them will result in:

**HTTP 404 Not Found**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Route GET:/api/properties not found"
}
```

## Development Best Practices

### Local Development
Enable all features you're working on:
```env
FEATURE_ARTICLES=true
FEATURE_PROPERTIES=true
# ... enable what you need
```

### Staging Environment
Mirror production feature flags to test realistic scenarios.

### Production Environment
Only enable fully tested and ready features.

## Troubleshooting

### Feature is enabled but endpoints return 404
1. Check `.env` file has correct values
2. Verify server was restarted after changing `.env`
3. Check server logs for "Enabled features" message

### Cannot access a feature that should be enabled
1. Verify environment variable is set to `true` (not `'true'` or `1`)
2. Check for typos in environment variable names
3. Ensure no trailing spaces in `.env` values

### Want to verify which features are enabled
Check the server startup logs or inspect the `features` object:
```typescript
import { features, getEnabledFeatures } from '@/config/features.config';
console.log(getEnabledFeatures());
```

## Adding New Features (For Developers)

When adding a new feature:

1. **Add to feature flags config** (`src/config/features.config.ts`):
   ```typescript
   export interface FeatureFlags {
     // ... existing flags
     newFeature: boolean;
   }
   
   export const features: FeatureFlags = {
     // ... existing features
     newFeature: process.env.FEATURE_NEW_FEATURE === 'true',
   };
   ```

2. **Update route registration** (`src/modules/user/routes/index.ts`):
   ```typescript
   if (features.newFeature) {
     routes.push(newFeatureRoutes);
   }
   ```

3. **Update documentation** (this file):
   - Add to Available Features table
   - Add to appropriate phase in rollout plan

4. **Update `.env` files**:
   - Add default value to your `.env`
   - Update documentation examples

## Technical Implementation

The feature flag system consists of:

- **`src/config/features.config.ts`** - Central configuration
- **`src/modules/user/routes/index.ts`** - Conditional route registration  
- **`src/middlewares/feature-guard.middleware.ts`** - Optional route guards
- **Environment variables** - Runtime configuration

Routes are conditionally registered at server startup based on feature flags. Disabled features have no API endpoints registered, making them completely inaccessible.
