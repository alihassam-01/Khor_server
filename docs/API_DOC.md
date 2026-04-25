# API Documentation

Comprehensive reference for the Khor server REST API.

> The wire format is exactly the same as before the unified-listing
> refactor — every public route, request body, and response shape is
> backward compatible. Internally the server now stores hotels and
> restaurants in a single polymorphic `listings` table, but the API
> shapes (`IHotelDTO`, `IRestaurantDTO`, etc.) are unchanged. See
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full story.

## Table of contents

- [Conventions](#conventions)
- [Auth](#auth)
- [Users](#users)
- [Hotels](#hotels)
- [Restaurants](#restaurants)
- [Properties (generic)](#properties-generic)
- [Subscription plans](#subscription-plans)
- [Ad payments](#ad-payments)
- [Payment settings](#payment-settings)
- [Analytics](#analytics)
- [Articles](#articles)
- [Locations](#locations)
- [Media uploads](#media-uploads)
- [Contact](#contact)
- [Error format](#error-format)

---

## Conventions

- All bodies and responses are JSON unless noted (`/media/upload` is
  multipart).
- Authenticated endpoints expect `Authorization: Bearer <jwt>`.
- IDs are UUIDs unless noted (`location_id` is an integer; subscription
  plan ids are UUIDs).
- Timestamps are ISO 8601 in UTC.
- All errors use the [error format](#error-format) below.

---

## Auth

Routes for sign-up, sign-in, OTP verification, password reset, and the
"who am I" lookup.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | – | Register a customer/vendor account. Sends OTP. |
| `POST` | `/auth/login` | – | Email + password login. |
| `POST` | `/auth/verify-otp` | – | Verify the OTP sent on register. |
| `POST` | `/auth/resend-otp` | – | Resend a verification OTP. |
| `POST` | `/auth/reset-password` | – | Reset using the link/token from email. |
| `POST` | `/auth/google/verify` | – | Exchange a Google ID token for a session. |
| `GET` | `/auth/me` | yes | Returns the authenticated user + profile. |

### Register

```http
POST /auth/register
{
  "username": "Jane",
  "email": "jane@example.com",
  "password": "secret-12",
  "userType": "vendor"
}
```

Response:

```json
{
  "id": "11111111-1111-1111-1111-111111111111",
  "email": "jane@example.com",
  "userType": "vendor",
  "isVerified": false
}
```

### Login

```http
POST /auth/login
{ "email": "...", "password": "..." }
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "userType": "vendor", "isVerified": true }
}
```

---

## Users

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/users` | yes | List all users (admin). |
| `GET` | `/vendors` | yes | Filter by `userType=vendor`. |
| `GET` | `/customers` | yes | Filter by `userType=customer`. |
| `GET` | `/users/:id` | yes | Fetch one user. |
| `POST` | `/users/:id` | yes | Update a user (mixed body shape — see DTO `IUpdateUserBody`). |
| `DELETE` | `/users/:id` | yes | Delete a user. |
| `PATCH` | `/users/:id/role` | yes | Change a user's role. |
| `POST` | `/users/password` | yes | Update password (current/new/confirm). |
| `POST` | `/users/forgot-password` | – | Send password reset email. |

User responses use `IUserResponseDto` — `profile` carries
`username`, `phone_number`, `profile_picture`, plus `business_name`
when the user is a vendor.

---

## Hotels

`IHotelDTO` is preserved exactly as in legacy. Internally stored under
`listings` with `type=hotel` plus a `hotel_details` row.

### Public reads

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/hotels` | Paginated + searchable hotel list. |
| `GET` | `/hotels/featured/:locationId` | Featured hotels in a location. |
| `GET` | `/hotels/premium` | Hotels with paid subscription tiers. |

Query params on `GET /hotels`:

| Name | Type | Notes |
| --- | --- | --- |
| `page` | int | default 1 |
| `limit` | int | default 10 |
| `searchQuery` | string | matches name + description + amenities (case-insensitive) |
| `location_id` | int | filter by location |
| `rating` | float | minimum `rating_avg` |
| `priceMax` | int | maximum `price_from` |
| `isFeatured` | bool | |
| `onlyActive` | bool | default true |

### Admin

All require auth.

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| `POST` | `/admin/hotels` | `ICreateHotelDTO` | Create. |
| `GET` | `/admin/hotels` | – | List (admin sees inactive too). |
| `GET` | `/admin/hotels/:id` | – | Detail. |
| `PUT` | `/admin/hotels/:id` | `IUpdateHotelDTO` | Update. |
| `DELETE` | `/admin/hotels/:id` | – | Soft delete. |
| `POST` | `/admin/hotels/:id/toggle-status` | `{ "is_active": bool }` | |
| `POST` | `/admin/hotels/:id/renew` | `{ "subscription_type": "...", "plan_id"?: "..." }` | |
| `POST` | `/admin/hotels/:id/featured` | `{ "is_featured": bool }` | |
| `GET` | `/admin/hotels/expired` | – | |
| `GET` | `/admin/hotels/vendor/:vendorId` | – | Hotels owned by a vendor. |

### Vendor

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/vendor/hotels/:id/renew` | Vendor-initiated renewal — opens a pending subscription period and an `ad_payments` intent. |

### `ICreateHotelDTO` (request)

```json
{
  "name": "Serena Hotel Skardu",
  "price": 15000,
  "location_name": "Skardu",
  "location_id": 1,
  "image": "https://cdn/cover.webp",
  "logo": "https://cdn/logo.webp",
  "images": ["https://cdn/g1.webp", "https://cdn/g2.webp"],
  "description": "Luxury hotel with mountain views",
  "amenities": ["wifi", "restaurant"],
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

### `IHotelDTO` (response shape)

Same shape as the request, plus:

```json
{
  "id": "uuid",
  "rating": 4.5,
  "reviews": 12,
  "active": true,
  "links": { "phone": "...", "whatsapp": "...", "facebook": null, "instagram": null, "website": null, "map_link": null },
  "detailed_reviews": [],
  "expires_at": "2026-05-18T14:00:00.000Z",
  "is_paid": true,
  "is_featured": false
}
```

`image` is the `cover` media item; `images[]` is the gallery (cover
first, then by `display_order`); `logo` is the `logo` media item.

---

## Restaurants

Same pattern as hotels, with `menu_images` instead of `roomTypes`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/admin/restaurants` | yes | Create. |
| `GET` | `/admin/restaurants` | yes | List. |
| `GET` | `/admin/restaurants/:id` | yes | Detail. |
| `PUT` | `/admin/restaurants/:id` | yes | Update. |
| `DELETE` | `/admin/restaurants/:id` | yes | Soft delete. |
| `POST` | `/admin/restaurants/:id/toggle-status` | yes | |
| `POST` | `/admin/restaurants/:id/renew` | yes | Admin renew. |
| `POST` | `/admin/restaurants/:id/featured` | yes | |
| `GET` | `/admin/restaurants/expired` | yes | |
| `GET` | `/admin/restaurants/vendor/:vendorId` | yes | |
| `POST` | `/vendor/restaurants/:id/renew` | yes | Vendor-initiated renewal. |
| `GET` | `/restaurants` | – | Public list. |
| `GET` | `/restaurants/featured/:locationId` | – | |
| `GET` | `/restaurants/premium/:locationId` | – | |

### `ICreateRestaurantDTO` (request)

```json
{
  "name": "Mountain View Restaurant",
  "location_name": "Skardu",
  "location_id": 1,
  "price": 1500,
  "image": "https://cdn/cover.webp",
  "menu_images": ["https://cdn/menu1.webp", "https://cdn/menu2.webp"],
  "description": "Traditional Pakistani cuisine",
  "phone": "+92-300-1234567",
  "vendor_id": "uuid-vendor-123",
  "subscription_type": "monthly"
}
```

### `IRestaurantDTO` (response shape)

```json
{
  "id": "uuid",
  "type": "restaurant",
  "name": "...",
  "location": "Skardu",
  "image": "https://cdn/cover.webp",
  "images": ["https://cdn/cover.webp"],
  "menu_images": ["https://cdn/menu1.webp", "https://cdn/menu2.webp"],
  "links": { "phone": "...", "whatsapp": null, "facebook": null, "instagram": null, "website": null, "map_link": null },
  "rating": 0, "reviews": 0,
  "active": true,
  "expires_at": "...",
  "is_paid": true,
  "is_featured": false,
  "subscription_type": "monthly"
}
```

---

## Properties (generic)

Vendor-dashboard convenience routes that work across listing types
(currently used for ad lookups).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/properties` | yes | Generic create — body discriminator decides hotel/restaurant. |
| `GET` | `/properties/vendor/:vendorId` | yes | All ads for a vendor (any type). |

---

## Subscription plans

Public catalog and admin management.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/subscription-plans` | – | All active plans. |
| `GET` | `/subscription-plans/compare` | – | Plans + featured pricing + `recommended`. |
| `GET` | `/subscription-plans/:type` | – | Plan by type (`free`/`monthly`/`quarterly`/`yearly`). |
| `GET` | `/subscription-plans/featured/pricing` | – | Featured-placement price. |
| `GET` | `/admin/subscription-plans` | yes | List incl. inactive. |
| `GET` | `/admin/subscription-plans/:id` | yes | Detail. |
| `POST` | `/admin/subscription-plans` | yes | Create. |
| `PUT` | `/admin/subscription-plans/:id` | yes | Update. |
| `DELETE` | `/admin/subscription-plans/:id` | yes | Delete. |
| `POST` | `/admin/subscription-plans/seed` | yes | Seed defaults if table is empty. |

---

## Ad payments

The DTO layer keeps the legacy `ad_id`/`ad_type` shape for backward
compatibility; on the database we now use proper FKs to `listings` and
`listing_subscriptions`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/admin/payments` | yes | Record a payment. |
| `GET` | `/admin/payments` | yes | All payments. |
| `GET` | `/admin/payments/:id` | yes | Detail. |
| `PATCH` | `/admin/payments/:id/status` | yes | Update status. |
| `GET` | `/admin/payments/vendor/:vendorId` | yes | Vendor payments. |
| `GET` | `/admin/payments/ad/:adId/:adType` | yes | Payment history for an ad. |
| `GET` | `/admin/payments/pending` | yes | Pending queue. |
| `DELETE` | `/admin/payments/:id` | yes | Delete. |
| `GET` | `/vendor/payments` | yes | "My" payments. |

For payload examples and the full subscription/payment workflow, see
[`ad_routes.md`](./ad_routes.md).

---

## Payment settings

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/payment-settings` | List active payment methods (public). |
| `POST` | `/admin/payment-settings` | Create. |
| `GET` | `/admin/payment-settings/:id` | Detail. |
| `PATCH` | `/admin/payment-settings/:id` | Update. |
| `DELETE` | `/admin/payment-settings/:id` | Delete. |

---

## Analytics

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/analytics/batch` | Batch-track events `{ adId, adType, type, timestamp }[]`. IP is hashed before storage. |
| `GET` | `/analytics/stats/:adId` | Aggregated stats for one listing. |
| `GET` | `/analytics/vendor/:vendorId` | Per-vendor roll-up. |

`adType` accepts the legacy `PropertyType` enum (`hotel`,
`restaurant`); internally normalized to `ListingType`.

---

## Articles

CMS layer. Pure JSON — image uploads use presigned URLs (see
[Media uploads](#media-uploads) and
[`ARTICLE_API_USAGE.md`](./ARTICLE_API_USAGE.md)).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/articles` | All articles. |
| `GET` | `/articles/list` | Paginated/filtered list. |
| `GET` | `/articles/search` | Fulltext search. |
| `GET` | `/articles/slug/:slug` | By slug. |
| `GET` | `/articles/:id` | By id. |
| `POST` | `/articles` | Create (admin). |
| `PUT` | `/articles/:id` | Update (admin). |
| `DELETE` | `/articles/:id` | Delete (admin). |

---

## Locations

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/locations` | All locations. |
| `GET` | `/locations/cities` | Cities only (`place_type='city'`). |
| `GET` | `/locations/by-type/:type` | Filter by `place_type`. |
| `GET` | `/locations/:id` | By id. |
| `GET` | `/locations/slug/:slug` | By slug. |
| `GET` | `/locations/children/:locationId` | Direct children. |
| `POST` | `/locations` | Create (admin). |
| `PUT` | `/locations/:id` | Update (admin). |
| `DELETE` | `/locations/:id` | Delete (admin). |
| `GET` | `/locations/categories` | All categories. |
| `POST` | `/locations/category` | Create category. |
| `GET` | `/locations/category/:id` | Category by id. |
| `PUT` | `/locations/category/:id` | Update. |
| `DELETE` | `/locations/category/:id` | Delete. |
| `GET` | `/locations/category/slug/:slug` | By slug. |
| `GET` | `/locations/by-category/:categoryname` | Locations in a category. |
| `POST` | `/locations/map-attributes` | Set attributes for a location. |
| `POST` | `/locations/map-categories` | Set categories for a location. |

---

## Media uploads

Two upload paths are supported. Both end with an `s3_images` row that
deduplicates by MD5 hash so re-uploading the same file returns the
existing URL.

### Multipart through the server

```
POST /media/upload          (Authorization required)
Content-Type: multipart/form-data

images=<file>[, <file>, ...]
type=hotels                 # optional folder name in R2
```

Response:

```json
{
  "uploads": [
    {
      "url": "https://cdn.example/hotels/abc.webp",
      "key": "hotels/abc.webp",
      "s3_image_id": "uuid"
    }
  ]
}
```

### Presigned URLs (recommended for clients)

```
POST /r2/presigned-url      single
POST /r2/presigned-urls     batch
POST /r2/upload             legacy server-side upload
```

Body for `/r2/presigned-url`:

```json
{ "filename": "cover.webp", "contentType": "image/webp", "folder": "hotels" }
```

Response includes a presigned PUT URL valid for ~10 minutes; the
client `PUT`s the bytes directly to R2 and then sends back the public
URL in subsequent `POST /admin/hotels` etc. requests.

---

## Contact

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/contact` | Send a contact-form message. |

---

## Error format

```json
{ "message": "Hotel not found" }
```

| HTTP | Meaning |
| --- | --- |
| 200 | OK |
| 201 | Created |
| 204 | No content |
| 400 | Validation/bad request |
| 401 | Unauthenticated |
| 403 | Authenticated but forbidden |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate review) |
| 500 | Internal server error |

Errors use `AppError` internally — see
`src/common/errors/error-codes.ts` for the canonical list.
