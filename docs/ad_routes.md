# Admin Ad Routes API Documentation

Complete API documentation for admin ad management endpoints.

---

## Table of Contents

- [Subscription Plan Management](#subscription-plan-management)
- [Hotel Ad Management](#hotel-ad-management)
- [Restaurant Ad Management](#restaurant-ad-management)
- [Payment Management](#payment-management)
- [Common Response Codes](#common-response-codes)

---

## Subscription Plan Management

### Public Endpoints (No Auth Required)

#### 1. Get All Active Plans

**Endpoint:** `GET /subscription-plans`

**Response:** `200 OK`

```json
[
  {
    "plan_id": "uuid-plan-123",
    "type": "quarterly",
    "name": "Quarterly Plan",
    "duration_days": 90,
    "price": 13500,
    "price_per_day": 150,
    "savings": 1500,
    "savings_percentage": 10,
    "description": "Best value for established businesses",
    "features": [
      "90 days listing",
      "Premium visibility",
      "Priority support",
      "Unlimited images",
      "Advanced analytics",
      "10% discount"
    ],
    "is_popular": true,
    "is_active": true,
    "display_order": 3
  }
]
```

#### 2. Get Plan by Type

**Endpoint:** `GET /subscription-plans/:type`

**URL Parameters:**

- `type` (string): "free", "monthly", "quarterly", or "yearly"

**Response:** `200 OK` - Single plan object

#### 3. Compare All Plans

**Endpoint:** `GET /subscription-plans/compare`

**Response:** `200 OK`

```json
{
  "plans": [...],
  "featured_pricing": {
    "price": 2000,
    "description": "Premium placement at the top of search results"
  },
  "recommended": "quarterly"
}
```

#### 4. Get Featured Pricing

**Endpoint:** `GET /subscription-plans/featured/pricing`

**Response:** `200 OK`

```json
{
  "price": 2000,
  "description": "Premium placement at the top of search results"
}
```

---

### Admin Endpoints

#### 5. Get All Plans (Including Inactive)

**Endpoint:** `GET /admin/subscription-plans`

**Response:** `200 OK` - Array of all plans including inactive ones

---

#### 6. Get Plan by ID

**Endpoint:** `GET /admin/subscription-plans/:id`

**URL Parameters:**

- `id` (string, required): Plan UUID

**Response:** `200 OK` - Single plan object

---

#### 7. Create Plan

**Endpoint:** `POST /admin/subscription-plans`

**Request Body:**

```json
{
  "type": "weekly",
  "name": "Weekly Plan",
  "duration_days": 7,
  "price": 1500,
  "description": "Perfect for short campaigns",
  "features": [
    "7 days listing",
    "Basic visibility",
    "Email support"
  ],
  "is_popular": false,
  "is_active": true,
  "display_order": 2
}
```

**Response:** `201 Created`

```json
{
  "plan_id": "uuid-plan-456",
  "type": "weekly",
  "name": "Weekly Plan",
  "duration_days": 7,
  "price": 1500,
  "price_per_day": 214,
  ...
}
```

---

#### 8. Update Plan

**Endpoint:** `PUT /admin/subscription-plans/:id`

**URL Parameters:**

- `id` (string, required): Plan UUID

**Request Body:** (All fields optional)

```json
{
  "price": 6000,
  "description": "Updated description",
  "features": ["New feature 1", "New feature 2"],
  "is_popular": true
}
```

**Response:** `200 OK` - Updated plan object

---

#### 9. Delete Plan

**Endpoint:** `DELETE /admin/subscription-plans/:id`

**URL Parameters:**

- `id` (string, required): Plan UUID

**Response:** `204 No Content`

---

#### 10. Seed Default Plans

**Endpoint:** `POST /admin/subscription-plans/seed`

**Description:** Seeds the database with default subscription plans (Free, Monthly, Quarterly, Yearly). Only works if no plans exist.

**Response:** `200 OK`

```json
{
  "message": "Default plans seeded successfully"
}
```

---

## Hotel Ad Management

### 1. Create Hotel Ad

**Endpoint:** `POST /admin/hotels`

**Request Body:**

```json
{
  "name": "Serena Hotel Skardu",
  "rating": 4.5,
  "reviews": 120,
  "price": 15000,
  "location_name": "Skardu, Gilgit-Baltistan",
  "image": "https://example.com/hotel.jpg",
  "description": "Luxury hotel with mountain views",
  "amenities": ["WiFi", "Restaurant", "Parking", "Room Service"],
  "logo": "https://example.com/logo.jpg",
  "verified": true,
  "phone": "+92-300-1234567",
  "whatsapp": "+92-300-1234567",
  "location_id": 1,
  "is_active": true,
  
  // Subscription Details (New)
  "vendor_id": "uuid-vendor-123", // Required for tracking owner
  "subscription_type": "monthly", // defaults to "free"
  // Available types: "free", "monthly", "quarterly", "yearly"
  
  "detailed_reviews": [
    {
      "user_name": "Ahmed Khan",
      "rating": 5,
      "comment": "Excellent service!",
      "date": "2026-01-15"
    }
  ],
  "roomTypes": [
    {
      "type": "Deluxe",
      "price": 12000,
      "amenities": ["King Bed", "WiFi", "TV"],
      "capacity": 2
    }
  ]
}
```

**Note on Creation:**

- `expires_at` is automatically calculated based on `subscription_type`.
- `is_paid` is automatically set to `true` if type is not "free".

**Response:** `201 Created`

```json
{
  "id": "uuid-hotel-456",
  "name": "Serena Hotel Skardu",
  "type": "hotel",
  "rating": 4.5,
  "reviews": 120,
  "price": 15000,
  "location": "Skardu, Gilgit-Baltistan",
  "image": "https://example.com/hotel.jpg",
  "description": "Luxury hotel with mountain views",
  "amenities": ["WiFi", "Restaurant", "Parking", "Room Service"],
  "logo": "https://example.com/logo.jpg",
  "verified": true,
  "links": {
    "phone": "+92-300-1234567",
    "whatsapp": "+92-300-1234567"
  },
  "vendor_id": "uuid-vendor-123",
  "expires_at": "2026-02-18T14:00:00Z",
  "subscription_type": "monthly",
  "is_paid": false,
  "is_featured": false,
  "detailed_reviews": [...],
  "roomTypes": [...]
}
```

---

### 2. Get All Hotels (Admin)

**Endpoint:** `GET /admin/hotels`

**Query Parameters:** None

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-hotel-456",
    "name": "Serena Hotel Skardu",
    "type": "hotel",
    "rating": 4.5,
    "reviews": 120,
    "price": 15000,
    "location": "Skardu, Gilgit-Baltistan",
    "vendor_id": "uuid-vendor-123",
    "expires_at": "2026-02-18T14:00:00Z",
    "subscription_type": "monthly",
    "is_paid": true,
    "is_featured": false,
    ...
  }
]
```

---

### 3. Get Hotel by ID

**Endpoint:** `GET /admin/hotels/:id`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Response:** `200 OK`

```json
{
  "id": "uuid-hotel-456",
  "name": "Serena Hotel Skardu",
  "type": "hotel",
  ...
}
```

**Error Response:** `404 Not Found`

```json
{
  "message": "Hotel not found"
}
```

---

### 4. Update Hotel

**Endpoint:** `PUT /admin/hotels/:id`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Request Body:** (All fields optional)

```json
{
  "name": "Updated Hotel Name",
  "price": 18000,
  "is_active": true,
  "is_featured": true,
  "subscription_type": "yearly",
  "vendor_id": "uuid-vendor-456"
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid-hotel-456",
  "name": "Updated Hotel Name",
  "price": 18000,
  ...
}
```

---

### 5. Delete Hotel

**Endpoint:** `DELETE /admin/hotels/:id`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Response:** `204 No Content`

---

### 6. Toggle Ad Status

**Endpoint:** `POST /admin/hotels/:id/toggle-status`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Request Body:**

```json
{
  "is_active": false
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid-hotel-456",
  "name": "Serena Hotel Skardu",
  "is_active": false,
  ...
}
```

---

### 7. Renew Ad Subscription

**Endpoint:** `POST /admin/hotels/:id/renew`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Request Body:**

```json
{
  "subscription_type": "quarterly"
}
```

**Subscription Types:**

- `"free"` - 30 days, 0 PKR
- `"monthly"` - 30 days, 5000 PKR
- `"quarterly"` - 90 days, 13500 PKR
- `"yearly"` - 365 days, 48000 PKR

**Response:** `200 OK`

```json
{
  "id": "uuid-hotel-456",
  "name": "Serena Hotel Skardu",
  "expires_at": "2026-05-18T14:00:00Z",
  "subscription_type": "quarterly",
  "is_paid": true,
  "is_active": true,
  ...
}
```

**Note:** Expiration date is automatically calculated:

- If current expiry is in future: adds duration to current expiry
- If expired or null: adds duration to current date

---

### 8. Get Expired Ads

**Endpoint:** `GET /admin/hotels/expired`

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-hotel-789",
    "name": "Expired Hotel",
    "expires_at": "2026-01-10T14:00:00Z",
    "is_active": false,
    ...
  }
]
```

**Note:** Returns hotels where `expires_at < now` OR `expires_at IS NULL`

---

### 9. Get Featured Ads

**Endpoint:** `GET /admin/hotels/featured`

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-hotel-456",
    "name": "Featured Hotel",
    "is_featured": true,
    "is_active": true,
    ...
  }
]
```

**Note:** Returns only active featured ads

---

### 10. Get Premium Ads

**Endpoint:** `GET /admin/hotels/premium`

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-hotel-456",
    "name": "Premium Hotel",
    "subscription_type": "yearly",
    "is_paid": true,
    ...
  }
]
```

**Note:** Returns ads with paid subscriptions (excludes free tier)

---

### 11. Get Ads by Vendor

**Endpoint:** `GET /admin/hotels/vendor/:vendorId`

**URL Parameters:**

- `vendorId` (string, required): Vendor UUID

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-hotel-456",
    "name": "Vendor's Hotel 1",
    "vendor_id": "uuid-vendor-123",
    ...
  },
  {
    "id": "uuid-hotel-789",
    "name": "Vendor's Hotel 2",
    "vendor_id": "uuid-vendor-123",
    ...
  }
]
```

---

### 12. Set Featured Status

**Endpoint:** `POST /admin/hotels/:id/featured`

**URL Parameters:**

- `id` (string, required): Hotel UUID

**Request Body:**

```json
{
  "is_featured": true
}
```

**Response:** `200 OK`

```json
{
  "id": "uuid-hotel-456",
  "name": "Serena Hotel Skardu",
  "is_featured": true,
  ...
}
```

**Note:** Featured ads cost extra (2000 PKR)

---

## Restaurant Ad Management

All restaurant endpoints follow the same structure as hotels, with `/admin/restaurants` instead of `/admin/hotels`.

### Endpoints

1. `POST /admin/restaurants` - Create restaurant
2. `GET /admin/restaurants` - Get all restaurants
3. `GET /admin/restaurants/:id` - Get restaurant by ID
4. `PUT /admin/restaurants/:id` - Update restaurant
5. `DELETE /admin/restaurants/:id` - Delete restaurant
6. `POST /admin/restaurants/:id/toggle-status` - Toggle status
7. `POST /admin/restaurants/:id/renew` - Renew subscription
8. `GET /admin/restaurants/expired` - Get expired ads
9. `GET /admin/restaurants/featured` - Get featured ads
10. `GET /admin/restaurants/premium` - Get premium ads
11. `GET /admin/restaurants/vendor/:vendorId` - Get vendor's ads
12. `POST /admin/restaurants/:id/featured` - Set featured status

**Restaurant-Specific Fields:**

```json
{
  "name": "Mountain View Restaurant",
  "location_name": "Skardu",
  "price": 1500,
  "rating": 4.2,
  "reviews": 85,
  "image": "https://example.com/restaurant.jpg",
  "phone": "+92-300-1234567",
  "whatsapp": "+92-300-1234567",
  "description": "Traditional Pakistani cuisine",
  "menu_images": [
    "https://example.com/menu1.jpg",
    "https://example.com/menu2.jpg"
  ],
  "location_id": 1,
  "is_active": true,
  
  // Subscription Details (New)
  "vendor_id": "uuid-vendor-123", // Required for tracking owner
  "subscription_type": "monthly" // defaults to "free"
}
```

**Note on Creation:**

- `expires_at` is automatically calculated based on `subscription_type`.
- `is_paid` is automatically set to `true` if type is not "free".

---

## Payment Management

### 1. Create Payment

**Endpoint:** `POST /admin/payments`

**Request Body:**

```json
{
  "ad_id": "uuid-hotel-456",
  "ad_type": "hotel",
  "vendor_id": "uuid-vendor-123",
  "amount": 5000,
  "payment_method": "bank_transfer",
  "transaction_id": "TXN123456789",
  "notes": "Monthly subscription payment",
  "receipt_url": "https://example.com/receipt.pdf"
}
```

**Payment Methods:**

- `"cash"`
- `"bank_transfer"`
- `"easypaisa"`
- `"jazzcash"`
- `"credit_card"`
- `"debit_card"`

**Ad Types:**

- `"hotel"`
- `"restaurant"`

**Response:** `201 Created`

```json
{
  "payment_id": "uuid-payment-789",
  "ad_id": "uuid-hotel-456",
  "ad_type": "hotel",
  "vendor_id": "uuid-vendor-123",
  "vendor_name": "Ahmed Khan",
  "amount": 5000,
  "payment_status": "pending",
  "payment_method": "bank_transfer",
  "transaction_id": "TXN123456789",
  "notes": "Monthly subscription payment",
  "receipt_url": "https://example.com/receipt.pdf",
  "created_at": "2026-01-18T14:00:00Z",
  "updated_at": "2026-01-18T14:00:00Z"
}
```

---

### 2. Get All Payments

**Endpoint:** `GET /admin/payments`

**Response:** `200 OK`

```json
[
  {
    "payment_id": "uuid-payment-789",
    "ad_id": "uuid-hotel-456",
    "ad_type": "hotel",
    "vendor_id": "uuid-vendor-123",
    "vendor_name": "Ahmed Khan",
    "amount": 5000,
    "payment_status": "completed",
    "payment_method": "bank_transfer",
    "created_at": "2026-01-18T14:00:00Z",
    ...
  }
]
```

---

### 3. Get Payment by ID

**Endpoint:** `GET /admin/payments/:id`

**URL Parameters:**

- `id` (string, required): Payment UUID

**Response:** `200 OK`

```json
{
  "payment_id": "uuid-payment-789",
  "ad_id": "uuid-hotel-456",
  "ad_type": "hotel",
  ...
}
```

---

### 4. Update Payment Status

**Endpoint:** `PATCH /admin/payments/:id/status`

**URL Parameters:**

- `id` (string, required): Payment UUID

**Request Body:**

```json
{
  "payment_status": "completed",
  "transaction_id": "TXN123456789",
  "notes": "Payment verified"
}
```

**Payment Statuses:**

- `"pending"` - Awaiting verification
- `"completed"` - Payment confirmed
- `"failed"` - Payment failed
- `"refunded"` - Payment refunded

**Response:** `200 OK`

```json
{
  "payment_id": "uuid-payment-789",
  "payment_status": "completed",
  "transaction_id": "TXN123456789",
  "updated_at": "2026-01-18T15:00:00Z",
  ...
}
```

---

### 5. Get Payments by Vendor

**Endpoint:** `GET /admin/payments/vendor/:vendorId`

**URL Parameters:**

- `vendorId` (string, required): Vendor UUID

**Response:** `200 OK`

```json
[
  {
    "payment_id": "uuid-payment-789",
    "ad_id": "uuid-hotel-456",
    "ad_type": "hotel",
    "vendor_id": "uuid-vendor-123",
    "amount": 5000,
    "payment_status": "completed",
    ...
  },
  {
    "payment_id": "uuid-payment-790",
    "ad_id": "uuid-hotel-457",
    "ad_type": "hotel",
    "vendor_id": "uuid-vendor-123",
    "amount": 2000,
    "payment_status": "pending",
    ...
  }
]
```

**Use Case:** View all payments made by a specific vendor

---

### 6. Get Payments by Ad

**Endpoint:** `GET /admin/payments/ad/:adId/:adType`

**URL Parameters:**

- `adId` (string, required): Ad UUID
- `adType` (string, required): "hotel" or "restaurant"

**Response:** `200 OK`

```json
[
  {
    "payment_id": "uuid-payment-789",
    "ad_id": "uuid-hotel-456",
    "ad_type": "hotel",
    "amount": 5000,
    "payment_status": "completed",
    "created_at": "2026-01-18T14:00:00Z",
    ...
  },
  {
    "payment_id": "uuid-payment-800",
    "ad_id": "uuid-hotel-456",
    "ad_type": "hotel",
    "amount": 5000,
    "payment_status": "completed",
    "created_at": "2025-12-18T14:00:00Z",
    ...
  }
]
```

**Use Case:** View payment history for a specific ad (renewals)

---

### 7. Get Pending Payments

**Endpoint:** `GET /admin/payments/pending`

**Response:** `200 OK`

```json
[
  {
    "payment_id": "uuid-payment-791",
    "ad_id": "uuid-hotel-458",
    "vendor_id": "uuid-vendor-124",
    "vendor_name": "Ali Hassan",
    "amount": 5000,
    "payment_status": "pending",
    "payment_method": "cash",
    "created_at": "2026-01-18T14:00:00Z",
    ...
  }
]
```

**Use Case:** Admin dashboard to verify pending payments

---

### 8. Delete Payment

**Endpoint:** `DELETE /admin/payments/:id`

**URL Parameters:**

- `id` (string, required): Payment UUID

**Response:** `204 No Content`

---

## Common Response Codes

| Code | Status                | Description                   |
| ---- | --------------------- | ----------------------------- |
| 200  | OK                    | Request successful            |
| 201  | Created               | Resource created successfully |
| 204  | No Content            | Resource deleted successfully |
| 400  | Bad Request           | Invalid request data          |
| 404  | Not Found             | Resource not found            |
| 500  | Internal Server Error | Server error                  |

---

## Error Response Format

```json
{
  "message": "Error description here"
}
```

**Examples:**

```json
{
  "message": "Hotel not found"
}
```

```json
{
  "message": "Failed to create payment"
}
```

---

## Pricing Reference

| Subscription Type  | Duration | Price (PKR) |
| ------------------ | -------- | ----------- |
| Free               | 30 days  | 0           |
| Monthly            | 30 days  | 5,000       |
| Quarterly          | 90 days  | 13,500      |
| Yearly             | 365 days | 48,000      |
| Featured Placement | -        | 2,000       |

---

## Workflow Examples

### Example 1: Create Hotel Ad with Payment

```bash
# Step 1: Create hotel ad
POST /admin/hotels
{
  "name": "Serena Hotel",
  "vendor_id": "uuid-vendor-123",
  "subscription_type": "monthly",
  ...
}

# Step 2: Record payment
POST /admin/payments
{
  "ad_id": "uuid-hotel-456",
  "ad_type": "hotel",
  "vendor_id": "uuid-vendor-123",
  "amount": 5000,
  "payment_method": "bank_transfer"
}

# Step 3: Update payment status
PATCH /admin/payments/uuid-payment-789/status
{
  "payment_status": "completed"
}

# Step 4: Renew ad (sets expiration date)
POST /admin/hotels/uuid-hotel-456/renew
{
  "subscription_type": "monthly"
}
```

### Example 2: Make Ad Featured

```bash
# Step 1: Set featured status
POST /admin/hotels/uuid-hotel-456/featured
{
  "is_featured": true
}

# Step 2: Record featured payment
POST /admin/payments
{
  "ad_id": "uuid-hotel-456",
  "ad_type": "hotel",
  "vendor_id": "uuid-vendor-123",
  "amount": 2000,
  "payment_method": "easypaisa",
  "notes": "Featured placement fee"
}
```

### Example 3: Check Vendor's Payment History

```bash
# Get all payments by vendor
GET /admin/payments/vendor/uuid-vendor-123

# Response shows all payments made by this vendor
[
  {
    "payment_id": "uuid-payment-789",
    "ad_id": "uuid-hotel-456",
    "amount": 5000,
    "payment_status": "completed",
    ...
  },
  {
    "payment_id": "uuid-payment-790",
    "ad_id": "uuid-hotel-456",
    "amount": 2000,
    "payment_status": "completed",
    "notes": "Featured placement fee",
    ...
  }
]
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All UUIDs are version 4
- Vendor must exist in users table
- Location must exist in locations table
- Payment status defaults to "pending"
- Subscription type defaults to "free"
- Featured status defaults to false
- Active status defaults to true
