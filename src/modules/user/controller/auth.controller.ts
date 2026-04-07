import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "@modules/user/service/auth.service";
import { UserType } from "@modules/user/entity/ENUM/enum";
import {
    ILoginDto,
    IRegisterDto,
    IVerifyOtpDto,
    IResendOtpDto,
    IResetPasswordDto,
    IGoogleVerifyDto,
} from "@modules/user/dtos/auth.dto";
import { logError } from "@lib/logger";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    async register(req: FastifyRequest<{ Body: IRegisterDto }>, reply: FastifyReply) {
        try {
            const userType = req.body.userType ?? UserType.CUSTOMER;
            await this.authService.register(req.body.email, req.body.password, userType, req.body.name);
            reply.code(201).send({ message: "Registration successful. Please check your email for a verification code." });
        } catch (error) {
            logError(error as Error, "User registration");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(400).send({ message: "Something went wrong", code: ErrorCodes.INTERNAL_SERVER_ERROR });
        }
    }

    async verifyOtp(req: FastifyRequest<{ Body: IVerifyOtpDto }>, reply: FastifyReply) {
        try {
            await this.authService.verifyOtp(req.body.email, req.body.otp);
            reply.send({ message: "Email verified successfully" });
        } catch (error) {
            logError(error as Error, "OTP verification");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(400).send({ message: "OTP verification failed", code: ErrorCodes.OTP_INVALID });
        }
    }

    async resendOtp(req: FastifyRequest<{ Body: IResendOtpDto }>, reply: FastifyReply) {
        try {
            await this.authService.resendOtp(req.body.email);
            reply.send({ message: "Verification code sent successfully" });
        } catch (error) {
            logError(error as Error, "Resend OTP");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(400).send({ message: "Failed to resend code", code: ErrorCodes.INTERNAL_SERVER_ERROR });
        }
    }

    async login(req: FastifyRequest<{ Body: ILoginDto }>, reply: FastifyReply) {
        try {
            const result = await this.authService.login(req.body.email, req.body.password);
            reply.send(result);
        } catch (error) {
            logError(error as Error, "User login");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(500).send({ message: "Login failed", code: ErrorCodes.INTERNAL_SERVER_ERROR });
        }
    }

    async resetPassword(req: FastifyRequest<{ Body: IResetPasswordDto }>, reply: FastifyReply) {
        try {
            const { token, newPassword, confirmPassword } = req.body;
            const result = await this.authService.resetPassword(token, newPassword, confirmPassword);
            reply.send(result);
        } catch (error) {
            logError(error as Error, "Password reset");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(400).send({ message: "Password reset failed", code: ErrorCodes.INTERNAL_SERVER_ERROR });
        }
    }

    async handleGoogleVerify(req: FastifyRequest<{ Body: IGoogleVerifyDto }>, reply: FastifyReply) {
        try {
            const { accessToken, userType } = req.body;
            const preferredType = userType === "customer" ? UserType.CUSTOMER : UserType.VENDOR;
            const result = await this.authService.googleLoginOrRegister(accessToken, preferredType);
            reply.send(result);
        } catch (error) {
            logError(error as Error, "Google OAuth verify");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(401).send({ message: "Google sign-in failed", code: ErrorCodes.INVALID_CREDENTIALS });
        }
    }

    async me(req: FastifyRequest, reply: FastifyReply) {
        try {
            const user = await this.authService.getCurrentUser(req.user.userId);
            reply.send(user);
        } catch (error) {
            logError(error as Error, "Get current user");
            if (error instanceof AppError) {
                return reply.code(error.statusCode).send({ message: error.message, code: error.errorCode });
            }
            reply.code(400).send({ message: "Failed to fetch user", code: ErrorCodes.INTERNAL_SERVER_ERROR });
        }
    }
}
