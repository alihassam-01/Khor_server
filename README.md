# Khor-server

## Overview
Khor-server is a backend application designed for the Travel Baltistan platform. It provides a comprehensive set of APIs and features to manage users, advertisements, articles, hotels, restaurants, locations, bookings, and more. The server is built with TypeScript and Node.js, using TypeORM for database management.

---

## How to Run

### Prerequisites
- Node.js
- npm or yarn
- PostgreSQL (or the configured database in `ormconfig.ts`)

### Setup Steps

2. **Install dependencies**
   ```sh
   npm install
   # or
   yarn install
   ```
3. **Configure Environment**
   - Copy `.env.example` to `.env` and update the values as needed.
   - Review and update `src/config/env.ts` and `src/config/ormconfig.ts` for database and other settings.
4. **Run Migrations**
   ```sh
   npm run typeorm migration:run
   ```
5. **Seed Data (Optional)**
   - Use scripts in `src/scripts/` to seed articles and locations:
     ```sh
     npm run seed:articles
     npm run seed:locations
     ```
6. **Start the Server**
   ```sh
   npm run start
   # or for development with hot reload
   npm run dev
   ```

---

## Functionality

### Core Modules
- **User Management**: Registration, authentication, profile, and user roles.
- **Advertisement Management**: CRUD for ads, ad payments, and subscription plans.
- **Article Management**: CRUD for articles, tags, and article-related features.
- **Hotel & Restaurant Management**: CRUD for hotels, restaurants, room types, and bookings.
- **Location Management**: CRUD for locations, geolocation features, and search.
- **Contact & Feedback**: Endpoints for user contact and feedback.
- **Media Handling**: Upload and manage images and media files.
- **Review System**: Users can leave reviews for hotels, restaurants, and other entities.

### API Structure
- All API routes are organized under `src/modules/*/routes/`.
- Controllers handle business logic in `src/modules/*/controller/`.
- Data validation is managed with DTOs in `src/modules/*/dtos/`.
- Entities (database models) are in `src/modules/*/entity/`.

### Error Handling
- Centralized error handling using custom `AppError` and global error handler middleware.
- Standardized error codes and messages.

### Authentication
- JWT-based authentication for secure API access.
- Middleware for route protection and feature-based access control.

### Configuration
- All configuration files are in `src/config/`.
- Feature flags and environment variables are supported.

### Database
- TypeORM is used for ORM and migrations.
- Migration files are in `src/migrations/`.

### Seeding
- Seeding scripts for articles and locations are in `src/scripts/`.

---

## Detailed Implementations

### 1. Modular Architecture
- Each domain (user, ads, articles, etc.) is separated into its own module with controllers, routes, DTOs, and entities.
- Promotes scalability and maintainability.

### 2. TypeORM Integration
- Database models are defined as entities.
- Migrations are used for schema changes.
- Repository pattern for database operations.

### 3. Error Handling
- Custom error classes and middleware for consistent error responses.
- Error codes are defined in `src/common/errors/error-codes.ts` and `src/common/constant/error.ts`.

### 4. Authentication & Authorization
- JWT tokens for user sessions.
- Middleware for authentication and feature-based access control.

### 5. Feature Flags
- Feature toggles are managed in `src/config/features.config.ts`.
- Allows enabling/disabling features without code changes.

### 6. Email Integration
- Email configuration in `src/config/emailConfig/emailConfig.ts`.
- Used for notifications, password resets, etc.

### 7. Media & File Uploads
- Media handling modules for image and file uploads.
- Integration with cloud storage (if configured).

### 8. API Documentation
- API usage and documentation are available in the `docs/` folder.

---

## Additional Resources
- See `docs/` for detailed API usage, migration guides, and feature documentation.
- For issues and suggestions, refer to `docs/CODEBASE_ISSUES_AND_SUGGESTIONS.md`.

---