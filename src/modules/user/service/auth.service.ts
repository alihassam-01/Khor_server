import { Repository } from "typeorm";
import { User, CustomerProfile, Vendor } from "@modules/user/entity";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import { UserRole } from "@common/enums";
import { CONFIG } from "@config/config";
import { sendEmail } from "./email";
import { otpVerificationTemplate } from "./email/templates/otpVerification";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logError, logInfo } from "@lib/logger";
import { OTP_LENGTH, OTP_EXPIRY_MINUTES } from "@modules/user/constant/otp.constant";
import { 
    ILoginResponseDto, 
    IGoogleLoginResponseDto, 
    ICurrentUserResponseDto 
} from "@modules/user/dtos";



import { EMAIL_SUBJECTS, AuditLogStatus, AuditLogEventType } from "@modules/user/constant/audit.constant";
import { AuditLogService } from "./audit-log.service";
import { PROFILE_IMAGES } from "@modules/user/constant/user.constant";

export class AuthService {
    private auditLogService = new AuditLogService();

    constructor(
        private userRepository: Repository<User>,
        private vendorRepository: Repository<Vendor>,
        private customerProfileRepository: Repository<CustomerProfile>
    ) {}

    private async validateEmailAvailable(email: string): Promise<void> {
        const existingUser = await this.userRepository.findOneBy({ email });
        if (existingUser) {
            throw new AppError("Email already in use", 400, ErrorCodes.VALIDATION_ERROR);
        }
    }

    public async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 10);
    }

    public async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    public generateOtp(): string {
        return crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH).toString();
    }

    public async hashOtp(otp: string): Promise<string> {
        return bcrypt.hash(otp, 10);
    }

    private randomProfileImage(): string {
        return PROFILE_IMAGES[Math.floor(Math.random() * PROFILE_IMAGES.length)];
    }

    async register(
        email: string,
        password: string,
        userRole: UserRole,
        name: string
    ): Promise<void> {
        await this.userRepository.manager.transaction(async (transactionalEntityManager) => {
            await this.validateEmailAvailable(email);

            const hashedPassword = await this.hashPassword(password);
            const otp = this.generateOtp();

            const hashedOtp = await this.hashOtp(otp);
            const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            const success = await sendEmail({
                to: email,
                subject: EMAIL_SUBJECTS.REGISTRATION_OTP,
                html: otpVerificationTemplate(name, otp, OTP_EXPIRY_MINUTES),
            });

            await this.auditLogService.log(
                AuditLogEventType.REGISTRATION_OTP,
                email,
                success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
                success ? undefined : "Email service returned failure",
                { name, role: userRole }
            );



            const user = this.userRepository.create({
                email,
                password: hashedPassword,
                userType: userRole,
                verificationToken: hashedOtp,
                otpExpiresAt,
                isVerified: false,
            });
            await transactionalEntityManager.save(User, user);

            if (userRole === UserRole.VENDOR) {
                const vendor = this.vendorRepository.create({
                    user,
                    username: name,
                    profile_picture: this.randomProfileImage(),
                });
                await transactionalEntityManager.save(Vendor, vendor);
            } else {
                const customerProfile = this.customerProfileRepository.create({
                    username: name,
                    user,
                    profile_picture: this.randomProfileImage(),
                });
                await transactionalEntityManager.save(CustomerProfile, customerProfile);
            }

            logInfo(`User registered successfully: ${email}, Role: ${userRole}`);
        });
    }

    async verifyOtp(email: string, otp: string): Promise<{ success: boolean; resetToken?: string }> {
        const user = await this.userRepository.findOneBy({ email });
        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (user.isVerified && !user.verificationToken) {
            throw new AppError("Email is already verified", 400, ErrorCodes.OTP_ALREADY_VERIFIED);
        }

        if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
            throw new AppError("OTP has expired", 400, ErrorCodes.OTP_EXPIRED);
        }

        if (!user.verificationToken) {
            throw new AppError("Invalid OTP", 400, ErrorCodes.OTP_INVALID);
        }

        const isMatch = await bcrypt.compare(otp, user.verificationToken);
        if (!isMatch) {
            throw new AppError("Invalid OTP", 400, ErrorCodes.OTP_INVALID);
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.otpExpiresAt = undefined;
        await this.userRepository.save(user);

        logInfo(`OTP verified successfully for user: ${email}`);

        // Generate a reset token that can be used for password reset (Step 3)
        if (!CONFIG.jwt.secret) {
            throw new Error("JWT_SECRET is not configured");
        }
        const resetToken = jwt.sign({ email }, CONFIG.jwt.secret as string, {
            expiresIn: "10m", // Short lived token for password reset
        });

        return { success: true, resetToken };
    }

    async resendOtp(email: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ["vendor", "customerProfile"],
        });

        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        if (user.isVerified) {
            throw new AppError("Email is already verified", 400, ErrorCodes.OTP_ALREADY_VERIFIED);
        }

        const otp = this.generateOtp();

        const hashedOtp = await this.hashOtp(otp);
        const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        user.verificationToken = hashedOtp;
        user.otpExpiresAt = otpExpiresAt;
        await this.userRepository.save(user);

        const username =
            user.userType === UserRole.VENDOR
                ? user.vendor?.username ?? email
                : user.customerProfile?.username ?? email;

        const success = await sendEmail({
            to: email,
            subject: EMAIL_SUBJECTS.RESEND_OTP,
            html: otpVerificationTemplate(username, otp, OTP_EXPIRY_MINUTES),
        });

        await this.auditLogService.log(
            AuditLogEventType.RESEND_OTP,
            email,
            success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
            success ? undefined : "Email service returned failure",
            { username }
        );


    }

    async login(email: string, password: string): Promise<ILoginResponseDto> {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ["vendor", "customerProfile"],
        });

        if (!user) {
            logError(new Error(`Login failed for email: ${email}`), "User login");
            throw new AppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS);
        }

        if (user.authProvider !== "local" || !user.password) {
            throw new AppError(
                "This account uses Google sign-in. Please sign in with Google.",
                401,
                ErrorCodes.INVALID_CREDENTIALS
            );
        }

        if (!(await bcrypt.compare(password, user.password))) {
            logError(new Error(`Login failed for email: ${email}`), "User login");
            throw new AppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS);
        }

        if (!user.isVerified) {
            logError(new Error(`Unverified email login attempt: ${email}`), "User login");
            throw new AppError(
                "Please verify your email before logging in",
                401,
                ErrorCodes.EMAIL_NOT_VERIFIED
            );
        }

        if (!CONFIG.jwt.secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const name =
            user.userType === UserRole.VENDOR
                ? user.vendor?.username ?? "Unknown"
                : user.customerProfile?.username;

        const token = jwt.sign(
            {
                userId: user.id,
                userType: user.userType,
                name: name ?? "Unknown",
                vendorId: user.userType === UserRole.VENDOR ? user.vendor?.id : undefined,
            },
            CONFIG.jwt.secret as string,
            { expiresIn: CONFIG.jwt.expiresIn as any }
        );

        logInfo(`User logged in successfully: ${email}`);
        return { token };
    }

    async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean }> {
        if (!token) {
            logError(new Error("Reset token missing"), "Password reset");
            throw new AppError("Reset token is required", 400, ErrorCodes.BAD_REQUEST);
        }
        if (!newPassword || !confirmPassword) {
            throw new AppError(
                "New password and confirm password are required",
                400,
                ErrorCodes.BAD_REQUEST
            );
        }
        if (newPassword !== confirmPassword) {
            throw new AppError("Passwords do not match", 400, ErrorCodes.BAD_REQUEST);
        }
        if (newPassword.length < 8) {
            throw new AppError(
                "New password must be at least 8 characters long",
                400,
                ErrorCodes.BAD_REQUEST
            );
        }

        let email: string;
        try {
            if (!CONFIG.jwt.secret) {
                throw new Error("JWT secret is not configured");
            }
            const payload = jwt.verify(token, CONFIG.jwt.secret as string) as { email: string };
            email = payload.email;
        } catch (err) {
            logError(err as Error, "Password reset - Invalid token");
            throw new AppError("Invalid or expired reset token", 400, ErrorCodes.BAD_REQUEST);
        }

        const user = await this.userRepository.findOneBy({ email });
        if (!user) {
            logError(new Error(`User not found for password reset: ${email}`), "Password reset");
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        user.password = await this.hashPassword(newPassword);
        user.isVerified = true;
        await this.userRepository.save(user);
        logInfo(`Password reset successfully for user: ${email}`);

        return { success: true };
    }

    async googleLoginOrRegister(
        accessToken: string,
        preferredUserRole: UserRole = UserRole.VENDOR
    ): Promise<IGoogleLoginResponseDto> {
        let googleUser: {
            sub: string;
            email: string;
            name?: string;
            picture?: string;
            email_verified?: boolean;
        };

        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error(`Google userinfo responded with ${res.status}`);
            googleUser = (await res.json()) as typeof googleUser;
        } catch (err) {
            logError(err as Error, "Google OAuth - userinfo fetch");
            throw new AppError("Invalid or expired Google token", 401, ErrorCodes.INVALID_CREDENTIALS);
        }

        if (!googleUser.email) {
            throw new AppError(
                "Could not retrieve email from Google account",
                400,
                ErrorCodes.INVALID_CREDENTIALS
            );
        }

        const { email, sub: googleId, name: googleName, picture } = googleUser;

        let existingUser = await this.userRepository.findOne({
            where: [{ googleId }, { email }],
            relations: ["vendor", "customerProfile"],
        });

        let isNewUser = false;

        if (!existingUser) {
            isNewUser = true;
            existingUser = await this.userRepository.manager.transaction(async (em) => {
                const newUser = this.userRepository.create({
                    email,
                    googleId,
                    authProvider: "google",
                    userType: preferredUserRole,
                    isVerified: true,
                });
                await em.save(User, newUser);

                const displayName = googleName ?? email.split("@")[0];
                const avatar = picture ?? this.randomProfileImage();

                if (preferredUserRole === UserRole.VENDOR) {
                    const vendor = this.vendorRepository.create({
                        user: newUser,
                        username: displayName,
                        profile_picture: avatar,
                    });
                    await em.save(Vendor, vendor);
                } else {
                    const profile = this.customerProfileRepository.create({
                        user: newUser,
                        username: displayName,
                        profile_picture: avatar,
                    });
                    await em.save(CustomerProfile, profile);
                }

                logInfo(`New user registered via Google OAuth: ${email}`);
                return newUser;
            });

            existingUser = (await this.userRepository.findOne({
                where: { id: existingUser.id },
                relations: ["vendor", "customerProfile"],
            }))!;
        } else if (!existingUser.googleId) {
            existingUser.googleId = googleId;
            if (!existingUser.isVerified) existingUser.isVerified = true;
            await this.userRepository.save(existingUser);
            logInfo(`Google account linked for existing user: ${email}`);
        }

        if (!CONFIG.jwt.secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const name =
            existingUser.userType === UserRole.VENDOR
                ? existingUser.vendor?.username ?? googleName ?? "Unknown"
                : existingUser.customerProfile?.username ?? googleName ?? "Unknown";

        const token = jwt.sign(
            {
                userId: existingUser.id,
                userType: existingUser.userType,
                name,
                vendorId:
                    existingUser.userType === UserRole.VENDOR ? existingUser.vendor?.id : undefined,
            },
            CONFIG.jwt.secret as string,
            { expiresIn: CONFIG.jwt.expiresIn as any }
        );

        return { token, isNewUser };
    }

    async getCurrentUser(userId: string): Promise<ICurrentUserResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["vendor", "customerProfile"],
        });

        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        const username =
            user.userType === UserRole.VENDOR
                ? user.vendor?.username
                : user.customerProfile?.username;

        return {
            userId: user.id,
            email: user.email,
            username: username ?? "Unknown",
            userType: user.userType,
            vendorId: user.userType === UserRole.VENDOR ? user.vendor?.id : undefined,
        };
    }
}
