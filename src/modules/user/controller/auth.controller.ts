import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "@modules/user/service/auth.service";
import { UserRole } from "@common/enums";
import {
    ILoginDto,
    IRegisterDto,
    IVerifyOtpDto,
    IResendOtpDto,
    IResetPasswordDto,
    IGoogleVerifyDto,
    IAuthMessageResponseDto,
    ILoginResponseDto,
    IGoogleLoginResponseDto,
    ICurrentUserResponseDto,
    IRefreshSessionResponseDto,
} from "@modules/user/dtos";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { AuthCookieScope } from "@modules/user/constant/auth-token.constant";
import {
    clearRefreshTokenCookie,
    getRefreshTokenCookieName,
    getRefreshTokenCookieScope,
    setRefreshTokenCookie,
} from "@modules/user/service/auth-session.util";

export class AuthController {
    constructor(private readonly authService: AuthService) {}

    private getCookieScope(req: FastifyRequest): AuthCookieScope {
        return getRefreshTokenCookieScope(req);
    }

    async register(req: FastifyRequest<{ Body: IRegisterDto }>, reply: FastifyReply) {
        const userRole = req.body.userType ?? UserRole.CUSTOMER;
        const ownerName = req.body.ownerName?.trim();
        const businessName = req.body.businessName?.trim();
        const effectiveName = userRole === UserRole.VENDOR
            ? (ownerName || req.body.name)
            : req.body.name;

        await this.authService.register(
            req.body.email,
            req.body.password,
            userRole,
            effectiveName,
            req.body.phone,
            req.body.cityId,
            {
                ownerName,
                businessName,
            },
        );
        const response: IAuthMessageResponseDto = { 
            message: "Registration successful. Please check your email for a verification code." 
        };
        reply.code(201).send(response);
    }

    async verifyOtp(req: FastifyRequest<{ Body: IVerifyOtpDto }>, reply: FastifyReply) {
        const result = await this.authService.verifyOtp(req.body.email, req.body.otp);
        const response: IAuthMessageResponseDto = { 
            message: "Email verified successfully",
            resetToken: result.resetToken 
        };
        reply.send(response);
    }

    async resendOtp(req: FastifyRequest<{ Body: IResendOtpDto }>, reply: FastifyReply) {
        await this.authService.resendOtp(req.body.email);
        const response: IAuthMessageResponseDto = { message: "Verification code sent successfully" };
        reply.send(response);
    }

    async login(req: FastifyRequest<{ Body: ILoginDto }>, reply: FastifyReply) {
        const result = await this.authService.login(req.body.email, req.body.password, {
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
        });
        setRefreshTokenCookie(reply, result.refreshToken, this.getCookieScope(req));
        const response: ILoginResponseDto = { token: result.token };
        reply.send(response);
    }

    async resetPassword(req: FastifyRequest<{ Body: IResetPasswordDto }>, reply: FastifyReply) {
        const { token, newPassword, confirmPassword } = req.body;
        const result = await this.authService.resetPassword(token, newPassword, confirmPassword);
        reply.send(result);
    }

    async handleGoogleVerify(req: FastifyRequest<{ Body: IGoogleVerifyDto }>, reply: FastifyReply) {
        const { accessToken, userType } = req.body;
        const preferredRole = userType === "vendor" ? UserRole.VENDOR : UserRole.CUSTOMER;
        const result = await this.authService.googleLoginOrRegister(accessToken, preferredRole, {
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
        });
        setRefreshTokenCookie(reply, result.refreshToken, this.getCookieScope(req));
        const response: IGoogleLoginResponseDto = { token: result.token, isNewUser: result.isNewUser };
        reply.send(response);
    }

    async refresh(req: FastifyRequest, reply: FastifyReply) {
        const scope = this.getCookieScope(req);
        const refreshToken = req.cookies?.[getRefreshTokenCookieName(scope)];
        if (!refreshToken) {
            throw new AppError("Refresh token is required", 401, ErrorCodes.UNAUTHORIZED);
        }

        const result = await this.authService.refreshSession(refreshToken, {
            ip: req.ip,
            userAgent: req.headers["user-agent"] || null,
        });
        setRefreshTokenCookie(reply, result.refreshToken, scope);
        const response: IRefreshSessionResponseDto = { token: result.token };
        reply.send(response);
    }

    async logout(req: FastifyRequest, reply: FastifyReply) {
        const scope = this.getCookieScope(req);
        const refreshToken = req.cookies?.[getRefreshTokenCookieName(scope)];
        await this.authService.logout(refreshToken);
        clearRefreshTokenCookie(reply, scope);
        reply.code(204).send();
    }

    async me(req: FastifyRequest, reply: FastifyReply) {
        const userId = (req.user as any)?.userId || (req.user as any)?.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED);
        }
        const user: ICurrentUserResponseDto = await this.authService.getCurrentUser(userId);
        reply.send(user);
    }
}
