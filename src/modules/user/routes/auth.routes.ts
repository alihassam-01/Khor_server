import { FastifyInstance } from "fastify";
import { AuthController } from "@modules/user/controller/auth.controller";
import { AuthService } from "@modules/user/service/auth.service";
import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import { RefreshToken } from "@modules/user/entity/user/refresh-token.entity";
import { AppDataSource } from "@config/ormconfig";
import {
    loginSchema,
    registerSchema,
    verifyOtpSchema,
    resendOtpSchema,
    resetPasswordSchema,
    googleVerifySchema,
    refreshSessionSchema,
    logoutSchema,
} from "@modules/user/schemas/auth.schema";
import { authenticate } from "@middlewares/authenticate";
import { RATE_LIMITS } from "@config/rate-limit.config";

const userRepository = AppDataSource.getRepository(User);
const userProfileRepository = AppDataSource.getRepository(UserProfile);
const refreshTokenRepository = AppDataSource.getRepository(RefreshToken);

export default async function authRoutes(fastify: FastifyInstance) {
    const authService = new AuthService(userRepository, userProfileRepository, refreshTokenRepository);
    const authController = new AuthController(authService);

    fastify.post("/auth/register", {
        schema: registerSchema,
        config: { rateLimit: RATE_LIMITS.register },
    }, authController.register.bind(authController));

    fastify.post("/auth/login", {
        schema: loginSchema,
        config: { rateLimit: RATE_LIMITS.login },
    }, authController.login.bind(authController));

    fastify.post("/auth/verify-otp", {
        schema: verifyOtpSchema,
        config: { rateLimit: RATE_LIMITS.otpVerify },
    }, authController.verifyOtp.bind(authController));

    fastify.post("/auth/resend-otp", {
        schema: resendOtpSchema,
        config: { rateLimit: RATE_LIMITS.otpResend },
    }, authController.resendOtp.bind(authController));

    fastify.post("/auth/reset-password", {
        schema: resetPasswordSchema,
        config: { rateLimit: RATE_LIMITS.passwordReset },
    }, authController.resetPassword.bind(authController));

    fastify.post("/auth/google/verify", {
        schema: googleVerifySchema,
        config: { rateLimit: RATE_LIMITS.googleVerify },
    }, authController.handleGoogleVerify.bind(authController));

    fastify.post("/auth/refresh", {
        schema: refreshSessionSchema,
        config: { rateLimit: RATE_LIMITS.refreshSession },
    }, authController.refresh.bind(authController));

    fastify.post("/auth/logout", {
        schema: logoutSchema,
        config: { rateLimit: RATE_LIMITS.refreshSession },
    }, authController.logout.bind(authController));

    fastify.get("/auth/me", { preHandler: [authenticate] }, authController.me.bind(authController));
}
