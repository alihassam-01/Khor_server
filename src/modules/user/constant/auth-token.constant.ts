export const ACCESS_TOKEN_PURPOSE = "access";
export const ACCESS_TOKEN_ISSUER = "khor-api";
export const ACCESS_TOKEN_AUDIENCE = "khor-clients";

export const PASSWORD_RESET_TOKEN_PURPOSE = "password_reset";
export const PASSWORD_RESET_TOKEN_ISSUER = "khor-api";
export const PASSWORD_RESET_TOKEN_AUDIENCE = "khor-password-reset";

export const DETACH_BOOKING_TOKEN_PURPOSE = "detach_booking";
export const DETACH_BOOKING_TOKEN_ISSUER = "khor-api";
export const DETACH_BOOKING_TOKEN_AUDIENCE = "khor-booking-detach";

export type AuthCookieScope = "web" | "admin" | "partner";

export const REFRESH_TOKEN_COOKIE_NAME = "khor_refresh_token";
export const REFRESH_TOKEN_COOKIE_NAME_BY_SCOPE: Record<AuthCookieScope, string> = {
  web: "khor_refresh_token_web",
  admin: "khor_refresh_token_admin",
  partner: "khor_refresh_token_partner",
};
