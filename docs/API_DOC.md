# Khor API

Verified REST endpoint inventory for `Khor-server`.

This document is maintained against the route registrations in
`src/modules/user/routes/`. Every route below is served below the `/api`
prefix, except `/ping`. Feature-gated routes are marked below.

The route implementation is the source of truth for validation and response
shapes. DTOs and schemas are linked where a table would be less precise.

## Base URL and conventions

```text
https://api.gokhor.com/api
```

- `GET /ping` is outside the `/api` prefix.
- `JWT` means `Authorization: Bearer <access-token>`.
- `Admin` means JWT plus the admin authorization middleware.
- Listing, booking, user, vendor, and most document IDs are UUIDs unless a
  route explicitly uses an integer, slug, or another value.
- Location IDs are integers. Hotel and restaurant IDs are UUIDs.
- Bodies are JSON unless a route says `multipart/form-data`.
- Swagger UI is hosted at
  `https://api.gokhor.com/details/api/swagger_2026_08_v1`.
- The generated OpenAPI JSON is available at
  `https://api.gokhor.com/details/api/swagger_2026_08_v1/json`.
- The Swagger route is public; use the UI's `Authorize` button for JWT
  protected endpoints.

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/ping` | Public | Health check. Returns `{ "status": "ok" }`. |

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Register a customer or vendor; sends OTP. |
| POST | `/auth/login` | Public | Email/password login. |
| POST | `/auth/verify-otp` | Public | Verify registration OTP. |
| POST | `/auth/resend-otp` | Public | Resend OTP. |
| POST | `/auth/reset-password` | Public | Reset password using the reset token. |
| POST | `/auth/google/verify` | Public | Exchange a Google ID token for a session. |
| POST | `/auth/refresh` | Public/session cookie | Refresh an access token. |
| POST | `/auth/logout` | Public/session cookie | Revoke the refresh session. |
| GET | `/auth/me` | JWT | Return the authenticated user and profile. |

Request validation is defined in `src/modules/user/schemas/auth.schema.ts`.

## Users and hotel-owner administration

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/users` | Admin | List users. |
| GET | `/vendors` | Admin | List vendor users. |
| GET | `/customers` | Admin | List customer users. |
| GET | `/users/:id` | JWT; self or Admin | Get one user. |
| POST | `/users/:id` | JWT; self or Admin | Update a user. |
| POST | `/users/password` | JWT | Change the current user's password. |
| POST | `/users/forgot-password` | Public | Send a password-reset email. |
| DELETE | `/admin/users/:id` | Admin | Delete a user. |
| PATCH | `/admin/users/:id/role` | Admin | Change a user's role. |
| GET | `/admin/hotel-owners` | Admin | List hotel owners. |
| PATCH | `/admin/hotel-owners/:id/approve` | Admin | Approve a hotel owner. |
| PATCH | `/admin/hotel-owners/:id/suspend` | Admin | Suspend a hotel owner. |

## Admin listing visibility and platform settings

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/admin/listings` | Admin | List listings for administrative moderation. |
| PATCH | `/admin/listings/:id/public-visibility` | Admin | Update one listing's public visibility. |
| PATCH | `/admin/listings/bulk-visibility` | Admin | Update public visibility for multiple listings. |
| GET | `/admin/platform-settings` | Admin | Get platform settings. |
| PUT | `/admin/platform-settings` | Admin | Replace/update platform settings. |

## Hotels

### Public hotel reads

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/hotels` | Public | Paginated hotel list with filters. |
| GET | `/hotels/:id` | Public | Get one publicly visible hotel; `id` must be a UUID. |
| GET | `/hotels/featured/:locationId` | Public | Featured hotels for an integer location ID. |
| GET | `/hotels/premium` | Public | Hotels with premium subscriptions. |

Query parameters for `GET /hotels`:

| Name | Type | Description |
| --- | --- | --- |
| `page` | string/int | Page number; default `1`. |
| `limit` | string/int | Page size; default `10`. |
| `searchQuery` | string | Search text. |
| `location_id` | string/int | Integer location ID; descendants are included. Comma-separated IDs are accepted. |
| `rating` | string/float | Minimum rating. |
| `priceMax` | string/float | Maximum `price_from`. Use `priceMax`, not `price_max`. |
| `isFeatured` | string/bool | Filter featured listings. |

Example for hotels in location `2`:

```http
GET /api/hotels?location_id=2&page=1&limit=10&rating=2&priceMax=100
```

### Hotel administration and vendor operations

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/admin/hotels` | Admin | Create a hotel. JSON or multipart form. |
| GET | `/admin/hotels` | Admin | List hotels, including inactive listings. |
| GET | `/admin/hotels/:id` | Admin | Get a hotel by UUID. |
| PUT | `/admin/hotels/:id` | Admin | Update a hotel. |
| DELETE | `/admin/hotels/:id` | Admin | Soft-delete a hotel. |
| POST | `/admin/hotels/:id/toggle-status` | Admin | Set `is_active`; optional `plan_id`. |
| POST | `/admin/hotels/:id/renew` | Admin | Renew subscription; accepts `subscription_type` and optional `plan_id`. |
| PATCH | `/admin/hotels/:id/subscription-billing` | Admin | Update `paid_at` and/or `next_due_date`. |
| POST | `/admin/hotels/:id/featured` | Admin | Set `is_featured`. |
| GET | `/admin/hotels/expired` | Admin | List expired hotel ads. |
| GET | `/admin/hotels/vendor/:vendorId` | Admin | List a vendor's hotels. |
| POST | `/vendor/hotels/:id/renew` | JWT; vendor access checked | Vendor renewal. |
| PUT | `/vendor/hotels/:id` | JWT; vendor access checked | Update an owned hotel. |
| DELETE | `/vendor/hotels/:id/images` | JWT; vendor access checked | Remove an image; body contains `image_url`. |
| GET | `/vendor/hotels` | JWT | List the current vendor's hotels. |

Hotel DTOs are in `src/modules/user/dtos/hotel.dto.ts` and hotel route
registration is in `src/modules/user/routes/hotel.routes.ts`.

## Restaurants

### Public restaurant reads

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/restaurants` | Public | Paginated restaurant list with filters. |
| GET | `/restaurants/featured/:locationId` | Public | Featured restaurants for a location. |
| GET | `/restaurants/premium/:locationId` | Public | Premium restaurants for a location. |

`GET /restaurants` accepts the same query parameters as `GET /hotels`:
`page`, `limit`, `searchQuery`, `location_id`, `rating`, `priceMax`, and
`isFeatured`. There is no public `/restaurants/:id` route currently.

### Restaurant administration and vendor operations

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/admin/restaurants` | Admin | Create a restaurant. JSON or multipart form. |
| GET | `/admin/restaurants` | Admin | List restaurants, including inactive listings. |
| GET | `/admin/restaurants/:id` | Admin | Get a restaurant by UUID. |
| PUT | `/admin/restaurants/:id` | Admin | Update a restaurant. |
| DELETE | `/admin/restaurants/:id` | Admin | Soft-delete a restaurant. |
| POST | `/admin/restaurants/:id/toggle-status` | Admin | Set `is_active`; optional `plan_id`. |
| POST | `/admin/restaurants/:id/renew` | Admin | Renew subscription. |
| PATCH | `/admin/restaurants/:id/subscription-billing` | Admin | Update billing dates. |
| POST | `/admin/restaurants/:id/featured` | Admin | Set `is_featured`. |
| GET | `/admin/restaurants/expired` | Admin | List expired restaurant ads. |
| GET | `/admin/restaurants/vendor/:vendorId` | Admin | List a vendor's restaurants. |
| POST | `/vendor/restaurants` | JWT | Create a restaurant for the current vendor. |
| POST | `/vendor/restaurants/:id/renew` | JWT; vendor access checked | Vendor renewal. |
| PUT | `/vendor/restaurants/:id` | JWT; vendor access checked | Update an owned restaurant. |
| POST | `/vendor/restaurants/:id/menu/ocr` | JWT | OCR a restaurant menu image. |
| GET | `/vendor/restaurants` | JWT | List the current vendor's restaurants. |

Restaurant DTOs are in `src/modules/user/dtos/restaurant.dto.ts` and route
registration is in `src/modules/user/routes/restaurant.routes.ts`.

## Combined ads and promoted listings

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/ads/location/:location_id` | Public | Combined hotel/restaurant ads for one or more comma-separated integer location IDs. |
| GET | `/ads/hotel-restaurant` | Public | Combined hotel and restaurant search. |
| GET | `/promoted-listings` | Public | Promoted non-hotel listing surface. |

`GET /ads/hotel-restaurant` accepts `page`, `limit`, `searchQuery`, `type`
(`hotel`, `restaurant`, or `all`), `location_id`, `rating`, `priceMax`, and
`isFeatured`. `GET /promoted-listings` accepts the same filters, but its
`type` is `restaurant`, `tour`, or `all`.

## Bookings and availability

### Customer

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/bookings/detach` | Public | Detach a booking using `{ token }`. |
| POST | `/bookings/hotel/hold` | JWT | Create a temporary room hold. |
| POST | `/bookings/hotel/checkout` | JWT | Create customer checkout from a hotel booking request. |
| POST | `/bookings/:id/checkout` | JWT | Resume checkout for a booking. |
| GET | `/bookings/me` | JWT | List the current customer's bookings. |
| GET | `/bookings/:id` | JWT | Get a customer's booking. |
| GET | `/bookings/:id/timeline` | JWT | Get booking timeline. |
| POST | `/bookings/:id/cancel-request` | JWT | Request cancellation. |
| POST | `/bookings/refund-request` | JWT | Request a refund. |
| GET | `/bookings/:id/payment-status` | JWT | Verify customer payment status. |

Booking list queries include `page`, `limit`, `booking_status`, and
`listing_id`.

### Vendor

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/vendor/bookings` | JWT | Create a vendor booking. |
| GET | `/vendor/bookings` | JWT | List vendor bookings. |
| GET | `/vendor/booking-holds` | JWT | List active booking holds. |
| GET | `/vendor/bookings/:id` | JWT | Get a vendor booking. |
| GET | `/vendor/bookings/:id/timeline` | JWT | Get booking timeline. |
| PATCH | `/vendor/bookings/:id/confirm` | JWT | Confirm booking. |
| PATCH | `/vendor/bookings/:id/cancel` | JWT | Cancel booking. |
| PATCH | `/vendor/bookings/:id/check-in` | JWT | Check in guest. |
| PATCH | `/vendor/bookings/:id/complete` | JWT | Complete booking. |
| POST | `/vendor/bookings/:id/payments` | JWT | Record booking payment. |
| GET | `/vendor/bookings/:id/bill` | JWT | Get booking bill. |
| POST | `/vendor/bookings/:id/bill/items` | JWT | Add bill item. |
| DELETE | `/vendor/bookings/:id/bill/items/:itemId` | JWT | Remove bill item. |
| POST | `/vendor/bookings/:id/bill/payments` | JWT | Record bill payment. |
| PATCH | `/vendor/bookings/:id/bill/mark-paid` | JWT | Mark bill paid. |

### Admin

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/admin/bookings` | Admin | Create an admin booking. |
| GET | `/admin/bookings` | Admin | List all bookings. |
| GET | `/admin/bookings/offline-analytics` | Admin | Offline booking analytics; accepts `month`, `year`, and `listingId`. |
| GET | `/admin/bookings/:id` | Admin | Get a booking. |
| GET | `/admin/bookings/:id/timeline` | Admin | Get booking timeline. |
| PATCH | `/admin/bookings/:id/cancel` | Admin | Cancel booking. |
| PATCH | `/admin/bookings/:id/complete` | Admin | Complete booking. |
| PATCH | `/admin/bookings/:id/confirm` | Admin | Confirm booking. |
| GET | `/admin/refunds` | Admin | List refunds; accepts `page`, `limit`, and `status`. |
| GET | `/admin/refunds/:id` | Admin | Get refund. |
| PATCH | `/admin/refunds/:id/approve` | Admin | Approve refund. |
| PATCH | `/admin/refunds/:id/reject` | Admin | Reject refund. |
| PATCH | `/admin/refunds/:id/process` | Admin | Process refund. |

### Availability and payment callbacks

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/hotels/:id/room-types/:roomTypeId/availability` | Public | Check availability; requires `check_in_date` and `check_out_date`. IDs are UUIDs. |
| GET | `/bookings/roomtype/:roomTypeId/booked-dates` | Public | Get booked dates for a room type. |
| GET | `/payments/safepay/return/:result` | Public callback | Safepay return callback. |
| GET | `/payments/safepay/return/:result/:bookingId` | Public callback | Safepay return callback for a booking. |
| POST | `/payments/safepay/return/:result` | Public callback | Safepay return callback. |
| POST | `/payments/safepay/return/:result/:bookingId` | Public callback | Safepay return callback for a booking. |
| POST | `/payments/safepay/webhook` | Provider webhook | Safepay webhook. |

## Restaurant orders

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/bookings/:bookingId/restaurant-ordering` | JWT | Get restaurant-ordering context for a booking. |
| POST | `/bookings/:bookingId/restaurant-orders` | JWT | Create an online restaurant order. |
| GET | `/bookings/:bookingId/restaurant-orders` | JWT | List customer orders for a booking. |
| GET | `/vendor/restaurant-orders` | JWT | List vendor orders. |
| POST | `/vendor/restaurant-orders` | JWT | Create a manual vendor order. |
| PATCH | `/vendor/restaurant-orders/:orderId` | JWT | Update order details. |
| PATCH | `/vendor/restaurant-orders/:orderId/status` | JWT | Update order status. |
| POST | `/vendor/restaurant-orders/:orderId/payments` | JWT | Record vendor order payment. |
| POST | `/vendor/restaurant-orders/:orderId/email-receipt` | JWT | Email an order receipt. |

## Reviews

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/reviews/eligibility/:targetType/:targetId` | JWT | Check whether the current user may review a target. |
| GET | `/reviews/:targetType/:targetId` | Public | List reviews for a target; accepts `status`, `minRating`, `page`, and `limit`. |
| POST | `/reviews` | JWT | Create a review. |
| POST | `/reviews/target-ids` | Public | Bulk-fetch reviews by target IDs. |
| PATCH | `/reviews/:id/helpful` | JWT | Set `{ helpful: boolean }` for a review vote. |

## Notifications and realtime tickets

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/notifications/me` | JWT | List current-user notifications. |
| POST | `/notifications/:id/read` | JWT | Mark one notification read. |
| POST | `/notifications/read-all` | JWT | Mark all notifications read. |
| DELETE | `/notifications/me` | JWT | Clear current-user notifications. |
| POST | `/realtime/tickets` | JWT | Issue a one-time realtime ticket; body `scope` is `booking` or `support`. |
| GET | `/hotels/:id/events/stream` | Public SSE | Hotel booking event stream. |
| GET | `/bookings/events/stream` | Realtime ticket | Customer booking event stream; query `ticket`. |
| GET | `/vendor/booking-events/stream` | Realtime ticket | Vendor booking event stream; query `ticket`. |
| GET | `/admin/booking-events/stream` | Realtime ticket | Admin booking event stream; query `ticket`. |

## Support tickets

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/support/tickets` | JWT | Create a customer ticket. |
| GET | `/support/tickets/me` | JWT | List current customer's tickets. |
| GET | `/support/tickets/:id` | JWT | Get a customer ticket. |
| POST | `/support/tickets/:id/messages` | JWT | Add a customer message. |
| GET | `/support/tickets/stream` | Realtime ticket | Customer ticket SSE stream; query `ticket`. |
| GET | `/vendor/support/tickets` | JWT | List vendor tickets. |
| GET | `/vendor/support/tickets/:id` | JWT | Get a vendor ticket. |
| POST | `/vendor/support/tickets/:id/messages` | JWT | Add a vendor message. |
| GET | `/vendor/support/tickets/stream` | Realtime ticket | Vendor ticket SSE stream; query `ticket`. |
| GET | `/admin/support/tickets` | Admin | List all support tickets. |
| GET | `/admin/support/tickets/:id` | Admin | Get a support ticket. |
| POST | `/admin/support/tickets/:id/messages` | Admin | Add an admin message. |
| PATCH | `/admin/support/tickets/:id/status` | Admin | Update ticket status. |
| PATCH | `/admin/support/tickets/:id/escalate` | Admin | Escalate a ticket. |
| GET | `/admin/support/tickets/stream` | Realtime ticket | Admin ticket SSE stream; query `ticket`. |

## Partner onboarding and policies

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/partner/business-profile` | JWT | Get current partner business profile. |
| PUT | `/partner/business-profile` | JWT | Create or update business profile. |
| POST | `/partner/onboarding/submit` | JWT | Submit business profile for review. |
| GET | `/partner/policies/current` | Public | Get current partner policy. |
| POST | `/partner/policies/accept` | JWT | Accept current partner policy. |
| POST | `/partner/documents/presign` | JWT | Create a document upload presign URL. |
| POST | `/partner/documents/complete` | JWT | Complete a document upload. |
| GET | `/admin/businesses` | Admin | List business profiles. |
| GET | `/admin/businesses/:id` | Admin | Get a business profile. |
| PATCH | `/admin/businesses/:id/profile-review` | Admin | Review a business profile. |
| PATCH | `/admin/businesses/:id/capabilities/:capabilityType/review` | Admin | Review a business capability. |
| GET | `/public-policies/current` | Public | Get current public policies. |
| GET | `/admin/public-policies/current` | Admin | Get current public policies for administration. |
| PUT | `/admin/public-policies/current` | Admin | Update current public policies. |
| GET | `/admin/vendor-policy/current` | Admin | Get current vendor policy. |
| PUT | `/admin/vendor-policy/current` | Admin | Update current vendor policy. |

## Payouts and vendor payments

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/payouts` | Admin | List booking payouts. |
| POST | `/payouts` | Admin | Create a booking payout. |
| PATCH | `/payouts/:id/status` | Admin | Update payout status. |
| GET | `/payouts/vendor/:vendorId` | JWT | List payouts for a vendor. |
| GET | `/admin/vendor-payments/overview` | Admin | Monthly vendor-payment overview. |
| GET | `/admin/vendor-payments/:vendorId/ledger` | Admin | Vendor payment ledger. |
| POST | `/admin/vendor-payments/subscription-payment` | Admin | Record a subscription payment. |
| PATCH | `/admin/vendor-payments/:vendorId/subscription-type` | Admin | Update vendor subscription type. |

## Media and R2 uploads

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/media/upload` | JWT | Multipart upload. Fields: `images` and optional `type`. |
| GET | `/media/library` | JWT | List the current user's media library. |
| POST | `/r2/upload` | JWT | Legacy multipart server-side upload. |
| POST | `/r2/presigned-url` | JWT | Create one direct-upload presigned URL. |
| POST | `/r2/presigned-urls` | JWT | Create multiple direct-upload presigned URLs. |
| POST | `/r2/uploads/complete` | JWT | Complete presigned uploads. |

## Locations

Location routes are enabled by default and can be disabled with
`FEATURE_LOCATIONS=false`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/locations` | Public | List locations. |
| GET | `/locations/:id` | Public | Get a location by ID. |
| GET | `/locations/slug/:slug` | Public | Get a location by slug. |
| GET | `/locations/children/:locationId` | Public | Get direct child locations. |
| GET | `/locations/cities` | Public | List city locations. |
| GET | `/locations/by-type/:type` | Public | Filter locations by place type. |
| GET | `/locations/categories` | Public | List location categories. |
| GET | `/locations/category/:id` | Public | Get a category by ID. |
| GET | `/locations/category/slug/:slug` | Public | Get a category by slug. |
| GET | `/locations/by-category/:categoryname` | Public | List locations in a category. |
| POST | `/locations` | Admin | Create a location. |
| PUT | `/locations/:id` | Admin | Update a location. |
| DELETE | `/locations/:id` | Admin | Delete a location. |
| POST | `/locations/category` | Admin | Create a location category. |
| PUT | `/locations/category/:id` | Admin | Update a location category. |
| DELETE | `/locations/category/:id` | Admin | Delete a location category. |
| POST | `/locations/map-attributes` | Admin | Set location attributes. |
| POST | `/locations/map-categories` | Admin | Set location categories. |

## Articles and tags

These routes are enabled by default. Disable them with
`FEATURE_ARTICLES=false` and `FEATURE_TAGS=false` respectively.

### Articles

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/articles` | Public/optional JWT | Get published articles; accepts `all`, `categoryId`, `publishedAfter`, and `updatedAfter`. |
| GET | `/articles/slug/:slug` | Public/optional JWT | Get an article by slug. |
| GET | `/articles/search` | Public/optional JWT | Search articles; requires `term`. |
| GET | `/articles/:id` | Public/optional JWT | Get an article by ID. |
| GET | `/articles/list` | Admin | Admin article list; accepts pagination and status filters. |
| POST | `/articles` | Admin | Create an article. |
| PUT | `/articles/:id` | Admin | Update an article. |
| DELETE | `/articles/:id` | Admin | Delete an article. |

### Article tags

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/article-tags/article/:articleId` | Public | List tags assigned to an article. |
| GET | `/article-tags/tag/:tagId` | Public | List articles assigned to a tag. |
| POST | `/article-tags` | Admin | Assign one tag to an article. |
| POST | `/article-tags/bulk` | Admin | Assign multiple tags. |
| DELETE | `/article-tags` | Admin | Remove a tag assignment. |

### Tags

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/tags` | Public | List tags. |
| GET | `/tags/:tagId` | Public | Get one tag. |
| POST | `/tags` | Admin | Create a tag. |
| PUT | `/tags/:tagId` | Admin | Update a tag. |
| DELETE | `/tags/:tagId` | Admin | Delete a tag. |

## Flights

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/flights/search` | Public | Search flight offers. Required query: `from`, `to`, `date`. |
| GET | `/flights/calendar` | Public | Get future calendar prices. Required query: `from`, `to`, `date`. |

Flight schemas, including optional query fields and response shapes, are in
`src/modules/user/schemas/flights.schema.ts`.

## Analytics

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/analytics/batch` | Public | Batch-track analytics events. |
| GET | `/analytics/stats/:adId` | JWT | Get listing analytics. |
| GET | `/analytics/vendor/:vendorId` | JWT | Get vendor analytics; accepts `startDate`, `endDate`, and `listingType`. |

## Generic properties

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/properties` | JWT | Generic property creation; body discriminator selects listing type. |
| GET | `/properties/vendor/:vendorId` | JWT | Get vendor ads/properties. |

## SEO and contact

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/seo/render` | Public | Render SEO content; query `path`. |
| GET | `/seo/meta` | Public | Get SEO metadata; query `path`. |
| POST | `/contact` | Public | Submit a contact-form message. |

## Operational and integration endpoints

These routes are active but intended for trusted integrations or internal
services. They do not all use the normal JWT middleware.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/whatsapp-inbound/message` | Trusted webhook | Receive an inbound OpenClaw WhatsApp message. |
| POST | `/whatsapp-tools/search-rooms` | Internal caller | Search rooms for the WhatsApp tool integration. |
| POST | `/whatsapp-tools/start-admin-booking` | Internal caller | Start an admin booking flow. |
| POST | `/whatsapp-tools/confirm-admin-booking` | Internal caller | Confirm an admin booking flow. |
| POST | `/whatsapp-tools/create-customer-booking` | Internal caller | Create a customer booking through the integration. |

## Errors

The global error handler generally returns JSON containing an error message;
validation and application errors may also include `statusCode`, `code`, and
`error`. A UUID route parameter must be a UUID before it reaches the database.
For example, use `GET /api/hotels?location_id=2` to filter by location `2`,
not `GET /api/hotels/2`, because `/hotels/:id` treats `2` as a hotel UUID.
