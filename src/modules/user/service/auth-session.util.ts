import { FastifyReply } from "fastify";
import { CONFIG } from "@config/config";
import { REFRESH_TOKEN_COOKIE_NAME } from "@modules/user/constant/auth-token.constant";

const refreshCookieMaxAgeMs = CONFIG.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000;

export const getRefreshCookieMaxAgeMs = (): number => refreshCookieMaxAgeMs;

export const setRefreshTokenCookie = (reply: FastifyReply, refreshToken: string): void => {
    reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: CONFIG.env === "production",
        sameSite: "lax",
        path: "/api/auth",
        maxAge: Math.floor(refreshCookieMaxAgeMs / 1000),
    });
};

export const clearRefreshTokenCookie = (reply: FastifyReply): void => {
    reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: CONFIG.env === "production",
        sameSite: "lax",
        path: "/api/auth",
    });
};
