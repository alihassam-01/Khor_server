# Khor Server (`Khor-server`) - Complete Technical Documentation

## 1. Purpose and System Role

`Khor-server` is the central backend for the Travel Baltistan platform.

It serves four major clients:

- `Khor-frontend` (public/customer web)
- `Khor-admin` (internal operations/admin console)
- `khor-partner` (vendor operations workspace)
- background worker processes (scheduled jobs, notification delivery)

Primary platform domains implemented here:

- authentication and sessions (email/password, Google verify, OTP, refresh cookies)
- business onboarding and policy acceptance
- listings (hotels/restaurants) and listing subscriptions
- bookings (holds, checkout, lifecycle, refunds, payouts, status history)
- payments and payment settings
- notifications and outbox processing
- support tickets and realtime streams
- locations, articles, tags, contact, analytics, media upload

---

## 2. Runtime Topology

This codebase runs in two process modes:

1. **API Process** (`src/index.ts`)
   - Fastify server
   - request/response REST and SSE handling
   - optional in-process job scheduler (when role is `all`)

2. **Worker Process** (`src/worker.ts`)
   - no public HTTP API
   - DB connection + scheduled jobs only
   - used for notification outbox and scheduled tasks

Mode is controlled via `CONFIG.notifications.processRole` (`api`, `worker`, or `all`).

---

## 3. Boot Sequence (API)

Main file: `src/index.ts`

Initialization order:

1. Load env and validate production config.
2. Build allowed CORS origins (`web/admin/partner` domains + local loopback allowlist).
3. Create Fastify instance with:
   - body limit
   - proxy trust settings
   - logger enabled
4. Register global middleware/plugins:
   - multipart
   - formbody
   - cookies
   - global rate limit
   - security plugin (`helmet` + permissions policy)
   - CORS policy
5. Register health endpoint (`/ping`).
6. Register swagger (non-production).
7. Register TypeORM plugin.
8. Register all route modules under `/api`.
9. Install global error handler.
10. Optionally initialize jobs if role is `all`.
11. Start listening on configured host/port.

If DB init or route registration fails, process exits intentionally.

---

## 4. Boot Sequence (Worker)

Main file: `src/worker.ts`

Worker startup:

1. Validate production config.
2. Assert process role is `worker` or `all`.
3. Initialize `AppDataSource`.
4. Probe DB connection (`SELECT 1`).
5. Initialize jobs (`initJobs`).
6. Keep process running for scheduler lifecycle.

---

## 5. Core Structural Conventions

Server follows a layered module architecture:

```text
routes -> controllers -> services -> entities/repositories
```

### 5.1 Responsibilities by layer

- **routes/**
  - path registration
  - preHandler middleware (auth/admin checks)
  - schema attachment and rate limits
- **controller/**
  - HTTP adapter boundary
  - request extraction + response dispatch
- **service/**
  - domain/business logic
  - transactions and orchestration
  - notifications/email/job side effects
- **entity/**
  - TypeORM entities and relationships
- **dtos/** and **types/**
  - request/response contracts and helper query/body types

### 5.2 Route assembly

`src/modules/user/routes/index.ts` composes all modules and applies feature-gated route registration for:

- `articles`
- `locations`
- `tags`

---

## 6. High-Level Directory Map

```text
src/
  index.ts                              # API process bootstrap
  worker.ts                             # worker process bootstrap
  app/
    plugins/
      typeorm.ts
      security.ts
      swagger.ts
  config/
    config.ts                           # env parsing + validation
    features.config.ts                  # feature toggles
  common/
    enums/
    errors/
    utils/
  middlewares/
    authenticate.ts
    authorizeAdmin.ts
    ...
  migrations/                           # TypeORM migrations
  modules/user/
    routes/
    controller/
    service/
      listing/                          # listing strategy architecture
      email/                            # providers + templates
    entity/
      user/
      listing/
      booking/
      location/
      article/
      payment/
      review/
    dtos/
    types/
    jobs/
```

---

## 7. Domain Model Overview

Primary entities are grouped by bounded context:

- **User domain**
  - `user`, `user_profile`, `refresh_token`, business entities, policy acceptance
- **Listing domain**
  - `listing`, `hotel_details`, `restaurant_details`, `listing_media`, `hotel_room_type`, `listing_subscription`
- **Booking domain**
  - `hotel_booking`, `booking_room_hold`, `booking_payment`, `booking_refund`, `booking_status_history`, `booking_bill*`, `booking_payout`
- **Content/location**
  - `location*`, `article*`, `tags`
- **Payments and settings**
  - `ad_payment`, `payment_setting`, `platform_setting`
- **Operational events**
  - `notification_outbox`, `user_notification`, audit log entities

Listings are unified with polymorphic type behavior (hotel vs restaurant) while preserving API DTO compatibility.

---

## 8. Authentication and Session Architecture

Auth routes: `src/modules/user/routes/auth.routes.ts`

Implemented endpoints:

- `/auth/register`
- `/auth/login`
- `/auth/verify-otp`
- `/auth/resend-otp`
- `/auth/reset-password`
- `/auth/google/verify`
- `/auth/refresh`
- `/auth/logout`
- `/auth/me` (authenticated)

Auth service responsibilities (`auth.service.ts`):

- password hashing/verification (`bcrypt`)
- OTP generation and verification
- access and refresh token issuance
- reset token issuance/validation
- refresh token persistence/revocation
- onboarding-adjacent side effects (draft listing creation for vendors)
- audit logging

Cross-app session convention:

- all clients send `Authorization` access token
- refresh endpoint uses cookie-based refresh token
- clients identify themselves with `X-Auth-Scope` (`web`, `admin`, `partner`)

---

## 9. Booking System (Detailed)

Booking routes (`booking.routes.ts`) expose operations for three actors:

- customer endpoints (`/bookings/*`)
- vendor endpoints (`/vendor/bookings*`)
- admin endpoints (`/admin/bookings*`, `/admin/refunds*`)

### 9.1 Booking pipeline

1. **Hold creation**
   - customer creates temporary room hold
   - hold expiration scheduler clears stale holds
2. **Checkout**
   - checkout intent created
   - payment status tracked
3. **Booking confirmation lifecycle**
   - statuses move across pending/confirmed/check-in/completed/cancel states
4. **Billing augmentation**
   - vendor can add booking bill items and mark bill payments
5. **Refund lifecycle**
   - customer requests refund
   - admin approves/rejects/processes according to policy windows
6. **Payout integration**
   - vendor payout records generated from settlement path

### 9.2 Core booking service concerns

`booking.service.ts` includes:

- strict UUID/date validation
- room allocation normalization
- active promotion evaluation
- policy snapshot for refund eligibility
- auto-confirm logic from hotel configuration
- audit + status history writes
- notification and outbox enqueueing
- Safepay integration touchpoints

### 9.3 Realtime booking stream

SSE endpoints in booking routes provide event streams for booking updates.

Conventions:

- event name: `booking-event`
- stream auth ticket support
- public-event sanitizer path (`toPublicBookingRealtimeEvent`)

---

## 10. Notification Architecture

Key services:

- `notification.service.ts`
- `notification-outbox.service.ts`
- `notification-outbox-worker.service.ts`
- `whatsapp-adapter.service.ts`
- `whatsapp-message.service.ts`

Pattern:

1. API transaction writes domain updates.
2. Notification intent is stored to outbox.
3. Worker job scans due outbox rows.
4. Delivery is attempted (in-app, email, WhatsApp adapter paths).
5. retry/failure handling uses max attempts config.

This avoids losing notifications on request process failures.

---

## 11. Job Scheduler and Background Tasks

Job registration: `src/modules/user/jobs/index.ts`

Scheduled responsibilities:

- minutely:
  - release expired booking holds
  - expire stale payment windows
  - process notification outbox
- daily:
  - subscription expiration checks
  - owner check-in digest emails/WhatsApp queue
  - customer extra-bill digest
- monthly:
  - analytics report generation and send

Timezone is configurable (`NOTIFICATION_TIMEZONE`).

---

## 12. Media Upload Flow (R2/S3-Compatible)

Relevant routes/services:

- `r2client.routes.ts`
- `media.routes.ts`
- `r2client.service.ts`

Flow:

1. client requests one or many presigned upload URLs
2. client uploads directly to storage
3. client confirms upload completion to server
4. server stores media references (`listing_media`, optional `s3_images` registry link)

This keeps binary transfer off API process while preserving ownership and cleanup metadata.

---

## 13. Configuration and Environment

Central file: `src/config/config.ts`

Major config groups:

- DB (`DATABASE_URL` or host/port/user/password/db)
- JWT (`JWT_SECRET`, `JWT_RESET_SECRET`, expiries)
- SMTP/Resend provider details
- domain allowlist (`WEB_DOMAIN`, `ADMIN_DOMAIN`, `PARTNER_DOMAIN`)
- Safepay credentials, hosted checkout, and webhook endpoint
- R2 credentials and limits
- OCR/OpenRouter keys/models/daily limits
- notification worker/whatsapp settings
- server listen/body limits

Production startup enforces:

- strong JWT secrets (32+ chars)
- distinct reset secret
- required R2 config
- required web domain

---

## 14. Security and Request Controls

Security controls in code:

- `@fastify/helmet` in `security.ts`
- production CSP and HSTS
- permissions policy hardening
- CORS allowlist and loopback port guard
- global Fastify rate limiting
- auth middleware + admin authorization middleware

Error handling:

- centralized global error handler
- explicit process termination on critical startup failures
- typed `AppError` usage for domain-level failures

---

## 15. Feature Flags and Route Exposure

Feature flags live in `src/config/features.config.ts`.

Current toggles:

- `articles`
- `locations`
- `tags`

Flag behavior:

- toggles route registration at startup
- disabled feature routes return Fastify `404` (not registered)

---

## 16. End-to-End Multi-App Interaction Flows

## 16.1 Authentication flow (web/admin/partner)

1. Client logs in (`/api/auth/login`) with scope header.
2. Server issues access token + refresh cookie/session.
3. Client calls `/api/auth/me` to hydrate profile.
4. Access token expires -> client calls `/api/auth/refresh`.
5. Server validates refresh token and rotates/returns new access token.
6. Logout revokes refresh state and clears client session.

## 16.2 Partner onboarding -> draft inventory flow

1. Partner registers/verifies OTP.
2. Auth service validates vendor onboarding fields.
3. Service resolves city and creates draft hotel listing + contact + hotel details.
4. Vendor subscription defaults to free tier activation.
5. Admin reviews business profile/capabilities and policy acceptance artifacts.

## 16.3 Customer booking lifecycle flow

1. Customer discovers listing from frontend.
2. Hold endpoint reserves room inventory.
3. Checkout endpoint creates payable booking.
4. Vendor confirms/checks-in/completes in partner app.
5. Status updates stream to all clients via SSE.
6. Billing and refunds are processed by policy + admin decisions.
7. Notifications are emitted via outbox worker channels.

## 16.4 Admin governance flow

1. Admin app reviews listings, businesses, policies, and payments.
2. Admin routes (`/api/admin/*`) apply elevated permissions.
3. Actions update listing visibility, policy versions, payment settings, and refunds.
4. Downstream effects propagate to partner/customer experiences.

---

## 17. Testing and Verification

Primary script:

- `npm test` -> Node test runner over `tests/**/*.test.ts`

Type-check commands:

- `npx tsc --noEmit`
- `npx tsc --noEmit -p tests/tsconfig.json`

Migration commands:

- `npm run migration:run`
- `npm run migration:revert`
- `npm run migration:show`
- `npm run migration:generate -- <path>`

---

## 18. Build and Run Commands

- `npm run dev` (ts-node + nodemon)
- `npm run build`
- `npm start` (compiled server)
- `npm run start:worker` (compiled worker process)
- `npm run seed:locations`
- `npm run seed:articles`
- `npm run seed:all`

---

## 19. File-Level Conventions for Contributors

When extending server features:

1. add/update DTO and type definitions first
2. implement service logic with strict validation and typed errors
3. expose via controller and route module
4. apply auth and role middleware in route declaration
5. update docs under `docs/` and this file if behavior changes
6. add/adjust tests for request and service paths

Avoid:

- bypassing service layer from routes
- swallowing exceptions with broad catch blocks
- adding endpoint strings in multiple files without route constant patterns

---

## 20. Existing Supplemental Docs

`Khor-server/docs/` already contains focused references:

- `API_DOC.md`
- `FEATURES.md`
- `ENV_SETUP.md`
- `MIGRATIONS.md`
- `SEARCH_API.md`
- `MEDIA_UPLOAD_API.md`
- `SEEDING_GUIDE.md`
- `ad_routes.md`
- `CODEBASE_ISSUES_AND_SUGGESTIONS.md`
- `DEVELOPMENT_GUIDELINES.md`

Use those for endpoint-level or domain-specific operational detail; use this document as the complete architecture-level and e2e operational map.
