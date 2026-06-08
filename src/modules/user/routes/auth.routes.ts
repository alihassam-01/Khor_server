import { FastifyInstance } from "fastify";
import { AuthController } from "@modules/user/controller/auth.controller";
import { AuthService } from "@modules/user/service/auth.service";
import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import { AppDataSource } from "@config/ormconfig";
import {
    loginSchema,
    registerSchema,
    verifyOtpSchema,
    resendOtpSchema,
    resetPasswordSchema,
    googleVerifySchema,
} from "@modules/user/schemas/auth.schema";
import { authenticate } from "@middlewares/authenticate";

const userRepository = AppDataSource.getRepository(User);
const userProfileRepository = AppDataSource.getRepository(UserProfile);

export default async function authRoutes(fastify: FastifyInstance) {
    const authService = new AuthService(userRepository, userProfileRepository);
    const authController = new AuthController(authService);

    fastify.post("/auth/register", { schema: registerSchema }, authController.register.bind(authController));

    fastify.post("/auth/login", { schema: loginSchema }, authController.login.bind(authController));

    fastify.post("/auth/verify-otp", { schema: verifyOtpSchema }, authController.verifyOtp.bind(authController));

    fastify.post("/auth/resend-otp", { schema: resendOtpSchema }, authController.resendOtp.bind(authController));

    fastify.post("/auth/reset-password", { schema: resetPasswordSchema }, authController.resetPassword.bind(authController));

    fastify.post("/auth/google/verify", { schema: googleVerifySchema }, authController.handleGoogleVerify.bind(authController));

    fastify.get("/auth/me", { preHandler: [authenticate] }, authController.me.bind(authController));
}
