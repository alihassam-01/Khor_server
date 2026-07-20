import * as jwt from "jsonwebtoken";
import { CONFIG } from "@config/config";
import {
    DETACH_BOOKING_TOKEN_ISSUER,
    DETACH_BOOKING_TOKEN_AUDIENCE,
} from "@modules/user/constant/auth-token.constant";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

export interface DetachBookingTokenPayload {
    sub: string; // bookingId
    email: string;
    purpose: string;
}

export function generateDetachBookingToken(bookingId: string, email: string): string {
    const payload: Omit<DetachBookingTokenPayload, "purpose"> = {
        sub: bookingId,
        email,
    };

    return jwt.sign(payload, CONFIG.jwt.secret, {
        expiresIn: "7d", // token valid for 7 days
        issuer: DETACH_BOOKING_TOKEN_ISSUER,
        audience: DETACH_BOOKING_TOKEN_AUDIENCE,
        mutatePayload: true,
    });
}

export function verifyDetachBookingToken(token: string): DetachBookingTokenPayload {
    try {
        const decoded = jwt.verify(token, CONFIG.jwt.secret, {
            issuer: DETACH_BOOKING_TOKEN_ISSUER,
            audience: DETACH_BOOKING_TOKEN_AUDIENCE,
        }) as DetachBookingTokenPayload;

        return decoded;
    } catch (err) {
        throw new AppError("Invalid or expired detach booking token", 401, ErrorCodes.UNAUTHORIZED);
    }
}
