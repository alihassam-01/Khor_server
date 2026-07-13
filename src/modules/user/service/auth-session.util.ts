import { FastifyReply } from "fastify";
import { CONFIG } from "@config/config";
import {
    AuthCookieScope,
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_NAME_BY_SCOPE,
} from "@modules/user/constant/auth-token.constant";

const refreshCookieMaxAgeMs = CONFIG.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000;

export const getRefreshCookieMaxAgeMs = (): number => refreshCookieMaxAgeMs;

const normalizeCookieScope = (value: unknown): AuthCookieScope | null => {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase();
    if (normalized === "admin" || normalized === "partner" || normalized === "web") {
        return normalized;
    }
    return null;
};

const resolveCookieScope = (
    request: { headers?: { origin?: string | null; referer?: string | null; "x-auth-scope"?: string | string[] | null } } | undefined,
): AuthCookieScope => {
    const explicitScope = normalizeCookieScope(request?.headers?.["x-auth-scope"]);
    if (explicitScope) return explicitScope;

    const candidateUrl = request?.headers?.origin || request?.headers?.referer || "";
    try {
        const host = new URL(candidateUrl).hostname.toLowerCase();
        if (host.startsWith("admin.")) return "admin";
        if (host.startsWith("partners.") || host.startsWith("partner.")) return "partner";
    } catch {
        // ignore malformed or missing headers
    }
    return "web";
};

export const getRefreshTokenCookieName = (scope: AuthCookieScope): string => {
    return REFRESH_TOKEN_COOKIE_NAME_BY_SCOPE[scope] || REFRESH_TOKEN_COOKIE_NAME;
};

export const getRefreshTokenCookieScope = (request: { headers?: { origin?: string | null; referer?: string | null } } | undefined): AuthCookieScope => {
    return resolveCookieScope(request);
};

export const setRefreshTokenCookie = (reply: FastifyReply, refreshToken: string, scope: AuthCookieScope): void => {
    reply.setCookie(getRefreshTokenCookieName(scope), refreshToken, {
        httpOnly: true,
        secure: CONFIG.env === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: Math.floor(refreshCookieMaxAgeMs / 1000),
    });
};

export const clearRefreshTokenCookie = (reply: FastifyReply, scope: AuthCookieScope): void => {
    reply.clearCookie(getRefreshTokenCookieName(scope), {
        httpOnly: true,
        secure: CONFIG.env === "production",
        sameSite: "lax",
        path: "/api/auth",
    });
};

