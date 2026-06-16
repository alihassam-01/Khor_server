import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Repository, UpdateResult } from "typeorm";
import { CONFIG } from "../../src/config/config";
import { ErrorCodes } from "../../src/common/errors/error-codes";
import { AppError } from "../../src/common/errors/AppError";
import { User } from "../../src/modules/user/entity/user/user.entity";
import { UserProfile } from "../../src/modules/user/entity/user/user-profile.entity";
import { RefreshToken } from "../../src/modules/user/entity/user/refresh-token.entity";
import { AuthService } from "../../src/modules/user/service/auth.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMAIL = "customer@example.com";

const createService = (overrides: {
    findOneBy?: (where: unknown) => Promise<User | null>;
    save?: (user: User) => Promise<User>;
    update?: (criteria: unknown, values: unknown) => Promise<UpdateResult>;
} = {}) => {
    let findOneByCalls = 0;
    let lastWhere: unknown;
    let lastUpdate: { criteria: unknown; values: unknown } | undefined;

    const userRepository = {
        findOneBy: async (where: unknown) => {
            findOneByCalls += 1;
            lastWhere = where;
            return overrides.findOneBy?.(where) ?? null;
        },
        save: async (user: User) => overrides.save?.(user) ?? user,
        update: async (criteria: unknown, values: unknown) => {
            lastUpdate = { criteria, values };
            return overrides.update?.(criteria, values) ?? {
                generatedMaps: [],
                raw: [],
                affected: 0,
            };
        },
    } as unknown as Repository<User>;

    const profileRepository = {} as Repository<UserProfile>;
    const refreshTokenRepository = {
        createQueryBuilder: () => ({
            update: () => ({
                set: () => ({
                    where: () => ({
                        andWhere: () => ({
                            execute: async () => ({
                                generatedMaps: [],
                                raw: [],
                                affected: 0,
                            }),
                        }),
                    }),
                }),
            }),
        }),
    } as unknown as Repository<RefreshToken>;

    return {
        service: new AuthService(userRepository, profileRepository, refreshTokenRepository),
        getFindOneByCalls: () => findOneByCalls,
        getLastWhere: () => lastWhere,
        getLastUpdate: () => lastUpdate,
    };
};

test("password reset rejects a normal access token before querying for a user", async () => {
    const { service, getFindOneByCalls } = createService();
    const accessToken = jwt.sign(
        {
            userId: USER_ID,
            userType: "customer",
            name: "Customer",
        },
        CONFIG.jwt.secret,
        { expiresIn: "1h" },
    );

    await assert.rejects(
        service.resetPassword(accessToken, "NewPassword1", "NewPassword1"),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.errorCode, ErrorCodes.BAD_REQUEST);
            assert.equal(error.message, "Invalid or expired reset token");
            return true;
        },
    );
    assert.equal(getFindOneByCalls(), 0);
});

test("OTP verification issues a reset-only token with bound user claims", async () => {
    const otp = "123456";
    const user = {
        id: USER_ID,
        email: EMAIL,
        isVerified: false,
        verificationToken: await bcrypt.hash(otp, 4),
        otpExpiresAt: new Date(Date.now() + 60_000),
    } as User;
    const { service } = createService({
        findOneBy: async () => user,
    });

    const result = await service.verifyOtp(EMAIL, otp);
    assert.ok(result.resetToken);

    const payload = jwt.verify(result.resetToken, CONFIG.jwt.resetSecret, {
        algorithms: ["HS256"],
        issuer: "khor-api",
        audience: "khor-password-reset",
    });
    assert.notEqual(typeof payload, "string");
    if (typeof payload === "string") return;

    assert.equal(payload.sub, USER_ID);
    assert.equal(payload.email, EMAIL);
    assert.equal(payload.purpose, "password_reset");
    assert.equal(typeof payload.jti, "string");
    assert.equal(user.passwordResetJtiHash?.length, 64);
    assert.equal(user.isVerified, true);
    assert.equal(user.verificationToken, undefined);
    assert.equal(user.otpExpiresAt, undefined);
});

test("password reset requires reset-specific purpose, issuer, audience, and subject claims", async () => {
    const { service, getFindOneByCalls } = createService();
    const incompleteResetToken = jwt.sign(
        { email: EMAIL, purpose: "password_reset" },
        CONFIG.jwt.resetSecret,
        { expiresIn: "10m" },
    );

    await assert.rejects(
        service.resetPassword(incompleteResetToken, "NewPassword1", "NewPassword1"),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.errorCode, ErrorCodes.BAD_REQUEST);
            return true;
        },
    );
    assert.equal(getFindOneByCalls(), 0);
});

test("password reset atomically consumes the token subject, email, and jti", async () => {
    const { service, getLastUpdate } = createService({
        update: async () => ({
            generatedMaps: [],
            raw: [],
            affected: 1,
        }),
    });
    const jti = "one-time-reset-token-id";
    const resetToken = jwt.sign(
        {
            email: EMAIL,
            purpose: "password_reset",
        },
        CONFIG.jwt.resetSecret,
        {
            subject: USER_ID,
            jwtid: jti,
            issuer: "khor-api",
            audience: "khor-password-reset",
            expiresIn: "10m",
        },
    );

    const result = await service.resetPassword(resetToken, "NewPassword1", "NewPassword1");

    assert.deepEqual(result, { success: true });
    const update = getLastUpdate();
    assert.deepEqual(update?.criteria, {
        id: USER_ID,
        email: EMAIL,
        passwordResetJtiHash: crypto.createHash("sha256").update(jti).digest("hex"),
    });
    assert.equal((update?.values as User).isVerified, true);
    assert.equal((update?.values as User).passwordResetJtiHash, null);
    assert.notEqual((update?.values as User).password, "NewPassword1");
});

test("password reset rejects a consumed one-time token", async () => {
    const { service } = createService({
        update: async () => ({
            generatedMaps: [],
            raw: [],
            affected: 0,
        }),
    });
    const resetToken = jwt.sign(
        {
            email: EMAIL,
            purpose: "password_reset",
        },
        CONFIG.jwt.resetSecret,
        {
            subject: USER_ID,
            jwtid: "already-consumed",
            issuer: "khor-api",
            audience: "khor-password-reset",
            expiresIn: "10m",
        },
    );

    await assert.rejects(
        service.resetPassword(resetToken, "NewPassword1", "NewPassword1"),
        /Invalid or already used reset token/,
    );
});
