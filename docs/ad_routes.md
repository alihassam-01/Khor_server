# Ad Management API

End-to-end reference for hotel/restaurant ad management:
subscription plans, listing CRUD, the renewal flow, and ad payments.

## Table of contents

- [How it fits together](#how-it-fits-together)
- [Subscription plans](#subscription-plans)
- [Hotel ads](#hotel-ads)
- [Restaurant ads](#restaurant-ads)
- [Vendor renewal flow](#vendor-renewal-flow)
- [Ad payments](#ad-payments)
- [Pricing reference](#pricing-reference)
- [Workflow examples](#workflow-examples)
- [Common response codes](#common-response-codes)

---

## How it fits together

The April 2026 unification refactor moved subscription state off the
`hotels` / `restaurants` rows and into a dedicated
`listing_subscriptions` table, with an `ad_payments` row per actual
charge.

```
listings              → name, status, is_active, is_featured (denormalized)
listing_subscriptions → one row per period (history). status: pending/active/expired/cancelled
ad_payments           → one row per money movement. linked to a subscription period
subscription_plans    → catalog of plans (name, price, duration_days, features)
```

The DTOs the API exposes still look the same as before — `expires_at`,
`subscription_type`, `is_paid`, `is_featured`, `vendor_id` are still on
the `IHotelDTO` / `IRestaurantDTO` response. They are now read from the
*current* `listing_subscriptions` row at response time.

---

## Subscription plans

### Public

```http
GET /subscription-plans
GET /subscription-plans/:type            # type: free | monthly | quarterly | yearly
GET /subscription-plans/compare
GET /subscription-plans/featured/pricing
```

`GET /subscription-plans` response:

```json
[
  {
    "plan_id": "uuid",
    "type": "quarterly",
    "name": "Quarterly Plan",
    "duration_days": 90,
    "price": 13500,
    "price_per_day": 150,
    "savings": 1500,
    "savings_percentage": 10,
    "description": "Best value for established businesses",
    "features": ["90 days listing", "Premium visibility", "..."],
    "is_popular": true,
    "is_active": true,
    "display_order": 3
  }
]
```

`GET /subscription-plans/compare` returns all plans plus the featured
add-on price and a `recommended` type:

```json
{
  "plans": [...],
  "featured_pricing": { "price": 2000, "description": "Premium placement" },
  "recommended": "quarterly"
}
```

### Admin

```http
GET    /admin/subscription-plans          # incl. inactive
GET    /admin/subscription-plans/:id
POST   /admin/subscription-plans
PUT    /admin/subscription-plans/:id
DELETE /admin/subscription-plans/:id
POST   /admin/subscription-plans/seed     # idempotent: only seeds if empty
```

`POST /admin/subscription-plans` body:

```json
{
  "type": "weekly",
  "name": "Weekly Plan",
  "duration_days": 7,
  "price": 1500,
  "description": "Perfect for short campaigns",
  "features": ["7 days listing", "Basic visibility", "Email support"],
  "is_popular": false,
  "is_active": true,
  "display_order": 2
}
```

---

## Hotel ads

```http
POST   /admin/hotels                          # create
GET    /admin/hotels                          # list (admin sees inactive)
GET    /admin/hotels/:id
PUT    /admin/hotels/:id
DELETE /admin/hotels/:id                      # soft-delete

POST   /admin/hotels/:id/toggle-status        # { is_active: bool }
POST   /admin/hotels/:id/featured             # { is_featured: bool }
POST   /admin/hotels/:id/renew                # admin renew (no payment intent)
GET    /admin/hotels/expired
GET    /admin/hotels/vendor/:vendorId

POST   /vendor/hotels/:id/renew               # vendor renew (creates pending payment)

GET    /hotels                                # public list
GET    /hotels/featured/:locationId           # public
GET    /hotels/premium                        # public
```

### Create

```http
POST /admin/hotels
Authorization: Bearer <admin token>

{
  "name": "Serena Hotel Skardu",
  "rating": 4.5,
  "price": 15000,
  "location_name": "Skardu, Gilgit-Baltistan",
  "location_id": 1,
  "image": "https://cdn/cover.webp",
  "logo": "https://cdn/logo.webp",
  "images": ["https://cdn/g1.webp", "https://cdn/g2.webp"],
  "description": "Luxury hotel with mountain views",
  "amenities": ["wifi", "restaurant", "parking"],
  "verified": true,
  "phone": "+92-300-1234567",
  "whatsapp": "+92-300-1234567",
  "vendor_id": "uuid-vendor-123",
  "subscription_type": "monthly",
  "roomTypes": [
    {
      "name": "Deluxe King",
      "price": 12000,
      "amenities": ["wifi", "tv"],
      "capacity": 2,
      "total_rooms": 10
    }
  ]
}
```

What happens server-side:

1. `ListingService.create` opens a transaction.
2. A `listings` row is inserted with `type=hotel`, plus the matching
   `hotel_details` row.
3. Per-room rows go into `hotel_room_types`.
4. Cover/logo/gallery URLs are deduplicated (by `(role, url)` pair) and
   inserted into `listing_media` via `ListingMediaService.syncMedia`.
5. `ListingSubscriptionService.openPeriod` creates a
   `listing_subscriptions` row.
   - Free or zero-amount → `status = active`, listing is active
     immediately.
   - Paid → `status = pending`, an `ad_payments` intent is created,
     the listing stays inactive until an admin moves the payment to
     `completed`.
6. The strategy assembles the legacy `IHotelDTO` shape and returns it.

Response (`IHotelDTO`):

```json
{
  "id": "uuid",
  "type": "hotel",
  "name": "Serena Hotel Skardu",
  "rating": 0,
  "reviews": 0,
  "price": 15000,
  "location": "Skardu, Gilgit-Baltistan",
  "image": "https://cdn/cover.webp",
  "images": ["https://cdn/cover.webp", "https://cdn/g1.webp", "https://cdn/g2.webp"],
  "logo": "https://cdn/logo.webp",
  "active": false,
  "verified": true,
  "links": { "phone": "+92-300-1234567", "whatsapp": "+92-300-1234567", "facebook": null, "instagram": null, "website": null, "map_link": null },
  "vendor_id": "uuid-vendor-123",
  "subscription_type": "monthly",
  "is_paid": false,
  "is_featured": false,
  "expires_at": null
}
```

### Update

`PUT /admin/hotels/:id` accepts `IUpdateHotelDTO` — every field is
optional. The strategy's `fromUpdateDTO` only emits fields that are
actually present in the payload, so a partial update doesn't clobber
unrelated columns. Sending `image: "..."` updates only the `cover`
media item; sending `images: [...]` rebuilds the gallery scope only.

### Toggle / featured / renew

```http
POST /admin/hotels/:id/toggle-status
{ "is_active": false }
```

```http
POST /admin/hotels/:id/featured
{ "is_featured": true }
```

```http
POST /admin/hotels/:id/renew
{ "subscription_type": "quarterly", "plan_id": "uuid" }
```

Renew opens a brand-new period:

- If the current period is still in the future, the new `expires_at` =
  `current_expires_at + duration`.
- If expired/null, `expires_at = now + duration`.

The admin variant marks the period `active` and `is_paid=true`
immediately. The vendor variant (`/vendor/hotels/:id/renew`) creates a
*pending* period + an `ad_payments` intent and waits for admin
approval.

---

## Restaurant ads

Same shape, with `menu_images` instead of `roomTypes`:

```http
POST   /admin/restaurants
GET    /admin/restaurants
GET    /admin/restaurants/:id
PUT    /admin/restaurants/:id
DELETE /admin/restaurants/:id
POST   /admin/restaurants/:id/toggle-status
POST   /admin/restaurants/:id/featured
POST   /admin/restaurants/:id/renew
GET    /admin/restaurants/expired
GET    /admin/restaurants/vendor/:vendorId
POST   /vendor/restaurants/:id/renew

GET    /restaurants
GET    /restaurants/featured/:locationId
GET    /restaurants/premium/:locationId
```

Restaurant-specific fields in `ICreateRestaurantDTO`:

```json
{
  "menu_images": ["https://cdn/menu1.webp", "https://cdn/menu2.webp"]
}
```

These map to `listing_media` rows with `role = menu`.

---

## Vendor renewal flow

1. Vendor calls `POST /vendor/hotels/:id/renew` (or restaurants) with
   `{ "subscription_type": "monthly" }`.
2. Server resolves the plan, creates a `listing_subscriptions` row in
   `pending` state, and an `ad_payments` row in `pending` state.
   Listing flags do **not** flip yet.
3. Server emails the vendor with payment instructions
   (`/payment-settings`).
4. Vendor pays out-of-band and notifies admin (or attaches a receipt
   URL via the payments API).
5. Admin calls `PATCH /admin/payments/:id/status` with
   `{ "payment_status": "completed", ... }`.
6. The service flips the subscription period to `active`, sets
   `started_at` / `expires_at`, and updates listing `is_active=true`,
   `status=active`. From now on the listing appears in public results.

---

## Ad payments

```http
POST   /admin/payments                       # record a payment
GET    /admin/payments                       # all
GET    /admin/payments/:id
PATCH  /admin/payments/:id/status            # update status
GET    /admin/payments/vendor/:vendorId      # vendor history
GET    /admin/payments/ad/:adId/:adType      # by listing
GET    /admin/payments/pending               # admin queue
DELETE /admin/payments/:id

GET    /vendor/payments                      # "my" payments
```

### Create payment

The DTO still uses the legacy `ad_id` / `ad_type` keys for
backward-compat — internally the server maps them to `listing_id` /
`listing.type`.

```http
POST /admin/payments
{
  "ad_id": "uuid-listing",
  "ad_type": "hotel",
  "vendor_id": "uuid-vendor-123",
  "amount": 5000,
  "payment_method": "bank_transfer",
  "transaction_id": "TXN123456789",
  "notes": "Monthly subscription payment",
  "receipt_url": "https://example.com/receipt.pdf"
}
```

`payment_method`:

- `cash`
- `bank_transfer`
- `easypaisa`
- `jazzcash`
- `credit_card`
- `debit_card`

`payment_status`:

- `pending` (default)
- `completed`
- `failed`
- `refunded`

### Update status (the trigger that activates a listing)

```http
PATCH /admin/payments/:id/status
{ "payment_status": "completed", "transaction_id": "...", "notes": "..." }
```

If the payment is linked to a `listing_subscriptions` period,
moving it to `completed` triggers `ListingSubscriptionService.activate`
in the same transaction:

- subscription period → `status = active`, `is_paid = true`
- `started_at = now()`, `expires_at = baseDate + duration`
- listing → `is_active = true`, `status = active`

---

## Pricing reference

| Subscription | Duration | Price (PKR) |
| --- | --- | --- |
| Free | 30 days | 0 |
| Monthly | 30 days | 5,000 |
| Quarterly | 90 days | 13,500 |
| Yearly | 365 days | 48,000 |
| Featured (add-on) | – | 2,000 |

Constants live in
[`src/common/constants/business.constants.ts`](../src/common/constants/business.constants.ts).
Plans are dynamic in `subscription_plans`; the values above are the
defaults seeded by `POST /admin/subscription-plans/seed`.

---

## Workflow examples

### Create a paid hotel ad end-to-end

```http
# 1) Create the listing (vendor or admin). Listing starts inactive
#    because subscription_type=monthly is paid.
POST /admin/hotels
{ "name": "...", "vendor_id": "...", "subscription_type": "monthly", ... }
# → returns hotel with is_paid=false, active=false

# 2) Vendor pays out-of-band, admin records the payment.
POST /admin/payments
{
  "ad_id": "<hotel id>",
  "ad_type": "hotel",
  "vendor_id": "<vendor id>",
  "amount": 5000,
  "payment_method": "bank_transfer"
}

# 3) Admin marks payment completed → listing flips active.
PATCH /admin/payments/<payment id>/status
{ "payment_status": "completed" }
```

### Make an existing ad featured

```http
POST /admin/hotels/<id>/featured
{ "is_featured": true }

POST /admin/payments
{
  "ad_id": "<hotel id>",
  "ad_type": "hotel",
  "vendor_id": "<vendor id>",
  "amount": 2000,
  "payment_method": "easypaisa",
  "notes": "Featured placement fee"
}
```

### Vendor self-renewal

```http
POST /vendor/hotels/<id>/renew
{ "subscription_type": "quarterly" }

# Returns the pending listing_subscription + ad_payment intent.
# Admin finalizes via PATCH /admin/payments/<id>/status.
```

### Vendor payment history

```http
GET /admin/payments/vendor/<vendor-id>
```

---

## Common response codes

| Code | Status | Description |
| --- | --- | --- |
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 204 | No Content | Resource deleted |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing/invalid auth token |
| 403 | Forbidden | Authenticated but not allowed |
| 404 | Not Found | Resource not found |
| 409 | Conflict | E.g. duplicate review |
| 500 | Internal Server Error | Server error |

Error format:

```json
{ "message": "Hotel not found" }
```
