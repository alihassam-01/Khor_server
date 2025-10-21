# Codebase Issues and Suggestions

This document collects issues, observations, and suggested improvements across the codebase (focused on the `user` module and related configs). It is intended as a developer-facing checklist with concrete fixes, code examples, and priorities.

---

## Summary / How to use
- Each entry contains: location, problem, impact, suggested fix, and (where helpful) example code or commands.
- I prioritized items where they affect security, correctness, or developer productivity.
- After applying fixes, run your project's linter/typechecker and tests.

---

## High Priority (Security, correctness)

### 1) JWT secret usage inconsistency
- Location: `src/modules/user/service/auth.service.ts`, `src/modules/user/service/user.service.ts`, `src/config/config.ts`
- Problem: Some places read `process.env.JWT_SECRET` directly and others read `config.jwt.secret`. The code sometimes falls back to insecure defaults in `config` (e.g., `defaultsecretkey`) which may be deployed accidentally.
- Impact: Risk of weak or inconsistent secrets that compromise JWTs.
- Suggested fix:
  - Centralize JWT secret access via `config` and remove insecure defaults. Fail fast when secret is missing.
  - Example: In `config.ts`, set `jwt.secret` to `process.env.JWT_SECRET` without a default and throw or exit early when missing in production.

### 2) Password hashing salt rounds are hard-coded
- Location: `src/modules/user/service/auth.service.ts` (bcrypt.hash(..., 10))
- Problem: Salt rounds are magic number 10. It may be fine but should be configurable.
- Impact: Harder to tune performance vs security tradeoff.
- Suggested fix: Move salt rounds to `config` (e.g., `config.security.bcryptRounds`) and use it.

### 3) Reset/verify tokens use different secrets or env var names
- Location: `user.service.ts` uses `config.jwt.secret` while `auth.service.ts` uses `process.env.JWT_SECRET`. This mismatch can cause tokens to be invalid across services.
- Impact: Password reset or email verification tokens may not validate.
- Suggested fix: Always use `config.jwt.secret` (and ensure it's populated from `process.env.JWT_SECRET`).

### 4) Sending email without error handling
- Location: `user.service.ts` and `auth.service.ts` (calls to `sendEmail`) often assume email delivery succeeds.
- Problem: If email provider fails, operations may still proceed (e.g., create user) leaving users without verification.
- Impact: Users might not receive verification and can't login.
- Suggested fix: Wrap `sendEmail` in try/catch, log failures, and optionally retry or mark account state differently if email couldn't be sent.

---

## Medium Priority (Stability, maintainability)

### 5) Inconsistent error handling & custom error classes
- Location: Controllers (e.g., `user.controller.ts`) and services.
- Problem: Controllers sometimes catch specific errors (ValidationError, NotFoundError) but elsewhere services throw raw `Error` with JSON strings or messages. `AuthService` throws `new Error(JSON.stringify(...))` which is brittle to parse.
- Impact: Hard to produce consistent HTTP status codes and messages.
- Suggested fix:
  - Use custom error classes (like `ValidationError`, `NotFoundError`, `UnauthorizedError`) everywhere.
  - Avoid throwing stringified JSON in `Error`; throw typed errors (e.g., `throw new ValidationError('Email already in use')`).
  - Add a global error handler in Fastify to map error classes -> HTTP status codes and response shapes.

### 6) Controller methods missing try/catch and validation
- Location: `src/modules/user/controller/user.controller.ts` (many methods)
- Problem: Only some controller methods validate input or guard for errors; others let exceptions bubble to the framework.
- Impact: Inconsistent responses and potential crashes.
- Suggested fix:
  - Add try/catch to all controller methods or rely on a Fastify error handler plugin.
  - Use Fastify's schema validation or `class-validator` DTOs to validate request bodies and params.

### 7) Using `any` for update payloads and DTOs
- Location: `user.controller.ts`, `user.service.ts` (`updateUser` accepts `any`)
- Problem: Low type safety increases bugs.
- Suggested fix: Create explicit Update DTOs for user updates. Validate shape and allowed fields.

### 8) Repositories created directly from AppDataSource inside service class
- Location: `user.service.ts`
- Problem: Directly calling `AppDataSource.getRepository(...)` in class fields assumes DataSource is initialized at import time.
- Impact: If DataSource isn't initialized, the app may crash at startup or when tests run.
- Suggested fix:
  - Inject repositories or initialize them after AppDataSource.initialize().
  - Alternatively, lazily get repositories in the constructor or methods.

### 9) Inconsistent relation loading
- Location: `user.service.ts` `getUsers`, `getUserById` etc.
- Problem: Some queries use `relations` property with nested relations; others rely on later repository calls.
- Suggested fix: Decide on an approach: either use `select` and `relations` consistently or use query builder when you need complex joins. Add pagination for list endpoints.

### 10) Update logic uses loose checks for empty strings and null
- Location: `user.service.ts` `updateUser`
- Problem: Uses checks like `if (updateData.phoneNumber != "")` which treats null/undefined poorly and uses inconsistent property names (`profile_picture` vs `profilePicture`).
- Suggested fix: Normalize DTO key names, sanitize input, and use 'in' checks or a small helper `isDefined(value)`.

---

## Low Priority (Developer experience, performance)

### 11) Logging & observability
- Add structured logging (pino/winston) and include request ids in logs.

### 12) Caching
- For public-facing read-heavy endpoints, add caching (Redis) for profile lookups.

### 13) Add OpenAPI documentation
- Use `fastify-swagger` to publish API docs.

### 14) Add pagination & filtering to lists
- `getUsers`, `getVendors`, `getCustomers` should support limit/offset or cursor pagination.

---

## Concrete Code Suggestions and Snippets

### A) Centralize config and fail fast for JWT secret
- `src/config/config.ts`:
```ts
// ensure JWT_SECRET is set in production
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

export const config = {
  jwt: {
    secret: jwtSecret,
    salt: Number(process.env.SALT_ROUNDS) || 10,
  },
  // ...
};
```

### B) Replace raw `Error(JSON.stringify(...))` with typed errors
- In `AuthService.validateRegistration`, replace with:
```ts
if (existingUser) {
  throw new ValidationError('Email already in use');
}
```

### C) Make repository access lazy or injectable
- Option 1 (lazy):
```ts
private get userRepository() { return AppDataSource.getRepository(User); }
```
- Option 2 (constructor injection): pass repositories from the composition root.

### D) Controller error handling pattern
- Add a helper:
```ts
async function safeHandler(handler) {
  return async (req, reply) => {
    try { await handler(req, reply); }
    catch(err) { reply.status(mapErrorToStatus(err)).send(formatError(err)); }
  }
}
```

### E) Update DTO example
```ts
export interface UpdateUserDTO {
  phoneNumber?: string | null;
  profilePicture?: string | null;
  username?: string | null;
}
```

---

## Suggested Prioritized Roadmap (Quick Wins -> Larger Changes)
1. Centralize `config` handling for secrets and bcrypt rounds, fail early if missing in production. (High)
2. Replace stringified error usage with typed errors and add a global error handler. (High)
3. Add input validation on controllers via Fastify schemas or DTO + `class-validator`. (Medium)
4. Normalize DTOs (`user.dto.ts`) and remove `any` usage. (Medium)
5. Lazily initialize repositories or move to dependency injection. (Medium)
6. Add pagination to list endpoints. (Low)

---

## Next steps I can take for you (pick one or more)
- I can implement the central config changes and update usages across the project.
- I can add a global Fastify error handler and convert thrown errors to typed errors.
- I can add DTOs and validation for `createUser` and `updateUser` and update controller/service.
- I can run quick linter/typecheck and include the output in this doc.

---

Document generated by automated code analysis. If you'd like, I can now start applying the high-priority fixes automatically.
