import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import { RefreshToken } from "@modules/user/entity/user/refresh-token.entity";
import { BusinessCapability } from "@modules/user/entity/user/business-capability.entity";
import { BusinessProfile } from "@modules/user/entity/user/business-profile.entity";
import { PolicyAcceptance } from "@modules/user/entity/user/policy-acceptance.entity";
import { Location } from "@modules/user/entity/location";
import { HotelDetails, Listing, ListingContact } from "@modules/user/entity/listing";
import { HotelBooking } from "@modules/user/entity/booking/hotel-booking.entity";
import { EntityManager, Repository, IsNull } from "typeorm";
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
import { LocationType } from "@common/enums/location.enums";
import { ListingStatus, ListingType } from "@common/enums/listing.enums";
import {
    BusinessCapabilityType,
    BusinessCapabilityStatus,
    BusinessOnboardingStatus,
    PartnerAccessStatus,
} from "@common/enums/business.enums";
import { SubscriptionType } from "@common/enums/subscription.enums";
import {
    ILoginResponseDto,
    IGoogleLoginResponseDto,
    ICurrentUserResponseDto,
    IRefreshSessionResponseDto,
} from "@modules/user/dtos";
import {
    ACCESS_TOKEN_AUDIENCE,
    ACCESS_TOKEN_ISSUER,
    ACCESS_TOKEN_PURPOSE,
    PASSWORD_RESET_TOKEN_AUDIENCE,
    PASSWORD_RESET_TOKEN_ISSUER,
    PASSWORD_RESET_TOKEN_PURPOSE,
} from "@modules/user/constant/auth-token.constant";
import { getRefreshCookieMaxAgeMs } from "./auth-session.util";

type PasswordResetTokenPayload = jwt.JwtPayload & {
    email: string;
    purpose: typeof PASSWORD_RESET_TOKEN_PURPOSE;
    sub: string;
    jti: string;
};

type RefreshRequestMeta = {
    ip?: string | null;
    userAgent?: string | null;
};

type IssuedSession = {
    accessToken: string;
    refreshToken: string;
};

import {
    EMAIL_SUBJECTS,
    AuditLogStatus,
    AuditLogEventType,
} from "@modules/user/constant/audit.constant";
import { AuditLogService } from "./audit-log.service";
import { PROFILE_IMAGES } from "@modules/user/constant/user.constant";
import { VendorSubscriptionService } from "./listing/vendor-subscription.service";
import { VendorPolicyService } from "./vendor-policy.service";

export class AuthService {
    private auditLogService = new AuditLogService();
    private vendorSubscriptionService = new VendorSubscriptionService();
    private vendorPolicyService = new VendorPolicyService();

    constructor(
        private userRepository: Repository<User>,
        private profileRepository: Repository<UserProfile>,
        private refreshTokenRepository: Repository<RefreshToken>,
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

    private profileUsername(user: User, fallback?: string): string {
        return user.profile?.username || fallback || user.email.split("@")[0] || "Unknown";
    }

    private buildDraftHotelDescription(name: string): string {
        return `Draft hotel for ${name}. Update location, rooms, and property details to go live.`;
    }

    private normalizePhone(phone: string): string {
        return phone.trim();
    }

    private validatePhone(phone: string): string {
        const normalized = this.normalizePhone(phone);
        if (!/^\+?[0-9\s-]{7,}$/.test(normalized)) {
            throw new AppError("Phone number must contain only digits, spaces, hyphens and an optional leading +", 400, ErrorCodes.VALIDATION_ERROR);
        }
        return normalized;
    }

    private async resolveDraftHotelLocation(em: EntityManager, cityId: number): Promise<Location> {
        const locationRepo = em.getRepository(Location);
        const selected = await locationRepo.findOne({
            where: {
                location_id: cityId,
                is_deleted: false,
                location_type: LocationType.CITY,
            },
        });

        if (!selected) {
            throw new AppError(
                "A valid city is required to register a hotel owner.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        return selected;
    }

    private async createDraftHotelForVendor(
        em: EntityManager,
        user: User,
        name: string,
        phone: string,
        cityId: number,
    ): Promise<void> {
        const location = await this.resolveDraftHotelLocation(em, cityId);

        const listingRepo = em.getRepository(Listing);
        const contactRepo = em.getRepository(ListingContact);
        const hotelDetailsRepo = em.getRepository(HotelDetails);

        const listing = listingRepo.create({
            type: ListingType.HOTEL,
            name,
            description: this.buildDraftHotelDescription(name),
            price_from: 0,
            status: ListingStatus.ACTIVE,
            is_active: true,
            is_featured: false,
            is_public_visible: false,
            is_verified: false,
            rating_avg: 0,
            rating_count: 0,
            view_count: 0,
            latitude: null,
            longitude: null,
            amenities: [],
            vendor_id: user.id,
            location_id: location.location_id,
        });

        const savedListing = await listingRepo.save(listing);

        const contact = contactRepo.create({
            listing_id: savedListing.id,
            address: null,
            phone,
            whatsapp: phone,
            facebook: null,
            instagram: null,
            website: null,
            map_link: null,
        });
        await contactRepo.save(contact);

        const hotelDetails = hotelDetailsRepo.create({
            listing_id: savedListing.id,
            check_in_time: "12:00",
            check_out_time: "11:00",
            cancellation_policy: null,
            refund_cutoff_hours: null,
            auto_confirm_paid_bookings: false,
        });
        await hotelDetailsRepo.save(hotelDetails);
        await this.vendorSubscriptionService.activate(em, savedListing, {
            subscription_type: SubscriptionType.FREE,
        });

        logInfo("Draft hotel created for vendor", {
            userId: user.id,
            listingId: savedListing.id,
            locationId: location.location_id,
        });
    }

    private hashResetTokenId(jti: string): string {
        return crypto.createHash("sha256").update(jti).digest("hex");
    }

    private hashRefreshTokenSecret(secret: string): string {
        return crypto.createHash("sha256").update(secret).digest("hex");
    }

    private buildAccessToken(user: User): string {
        if (!CONFIG.jwt.secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        return jwt.sign(
            {
                userId: user.id,
                userType: user.userType,
                name: this.profileUsername(user),
                purpose: ACCESS_TOKEN_PURPOSE,
                vendorId: user.userType === UserRole.VENDOR ? user.id : undefined,
            },
            CONFIG.jwt.secret as string,
            {
                algorithm: "HS256",
                issuer: ACCESS_TOKEN_ISSUER,
                audience: ACCESS_TOKEN_AUDIENCE,
                expiresIn: CONFIG.jwt.expiresIn as any,
            },
        );
    }

    private createRefreshTokenExpiry(): Date {
        return new Date(Date.now() + getRefreshCookieMaxAgeMs());
    }

    private async issueRefreshToken(
        manager: EntityManager,
        userId: string,
        meta: RefreshRequestMeta,
        familyId?: string,
    ): Promise<{ token: string; entity: RefreshToken }> {
        const secret = crypto.randomBytes(32).toString("base64url");
        const effectiveFamilyId = familyId ?? crypto.randomUUID();
        const entity = manager.getRepository(RefreshToken).create({
            userId,
            familyId: effectiveFamilyId,
            tokenHash: this.hashRefreshTokenSecret(secret),
            expiresAt: this.createRefreshTokenExpiry(),
            createdByIp: meta.ip || null,
            userAgent: meta.userAgent || null,
            lastUsedAt: new Date(),
        });
        const saved = await manager.getRepository(RefreshToken).save(entity);
        return {
            token: `${saved.id}.${secret}`,
            entity: saved,
        };
    }

    private async issueSession(
        user: User,
        meta: RefreshRequestMeta,
    ): Promise<IssuedSession> {
        return this.userRepository.manager.transaction(async (manager) => {
            const refresh = await this.issueRefreshToken(manager, user.id, meta);
            return {
                accessToken: this.buildAccessToken(user),
                refreshToken: refresh.token,
            };
        });
    }

    private parseRefreshToken(rawToken: string): { id: string; secret: string } | null {
        const parts = rawToken.split(".");
        if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
        return { id: parts[0], secret: parts[1] };
    }

    private async revokeRefreshFamily(manager: EntityManager, familyId: string): Promise<void> {
        await manager.getRepository(RefreshToken)
            .createQueryBuilder()
            .update(RefreshToken)
            .set({ revokedAt: new Date() })
            .where(`"family_id" = :familyId`, { familyId })
            .andWhere(`"revoked_at" IS NULL`)
            .execute();
    }

    private async createOrUpdateVendorBusinessProfile(
        em: EntityManager,
        user: User,
        ownerName: string,
        businessName: string,
        phone: string,
        cityId: number,
    ): Promise<BusinessProfile> {
        const businessProfileRepo = em.getRepository(BusinessProfile);
        let businessProfile = await businessProfileRepo.findOne({
            where: { user_id: user.id },
        });

        if (!businessProfile) {
            businessProfile = businessProfileRepo.create({
                user_id: user.id,
                onboarding_status: BusinessOnboardingStatus.DRAFT,
            });
        }

        businessProfile.owner_legal_name = ownerName;
        businessProfile.business_name = businessName;
        businessProfile.phone_number = phone;
        businessProfile.city_id = cityId;
        businessProfile.onboarding_status = BusinessOnboardingStatus.DRAFT;
        businessProfile.submitted_at = null;
        businessProfile.reviewed_at = null;
        businessProfile.review_note = "Partner access auto-approved during hotel owner registration. Complete onboarding documents and policy next.";

        return businessProfileRepo.save(businessProfile);
    }

    private async ensureApprovedVendorCapability(
        em: EntityManager,
        user: User,
    ): Promise<void> {
        const businessProfile = await em.getRepository(BusinessProfile).findOneOrFail({
            where: { user_id: user.id },
        });
        const capabilityRepo = em.getRepository(BusinessCapability);
        let capability = await capabilityRepo.findOne({
            where: {
                business_profile_id: businessProfile.id,
                type: BusinessCapabilityType.HOTEL,
            },
        });

        if (!capability) {
            capability = capabilityRepo.create({
                business_profile_id: businessProfile.id,
                type: BusinessCapabilityType.HOTEL,
            });
        }

        capability.status = BusinessCapabilityStatus.APPROVED;
        capability.review_note = "Partner access auto-approved during hotel owner registration.";
        capability.approved_at = new Date();

        await capabilityRepo.save(capability);
    }

    async register(
        email: string,
        password: string,
        userRole: UserRole,
        name: string,
        phone?: string,
        cityId?: number,
        options?: {
            ownerName?: string | null;
            businessName?: string | null;
        },
    ): Promise<void> {
        await this.userRepository.manager.transaction(async (em) => {
            await this.validateEmailAvailable(email);
            const normalizedPhone = userRole === UserRole.VENDOR
                ? this.validatePhone(phone ?? "")
                : (phone?.trim() || null);
            const ownerName = options?.ownerName?.trim() || name;
            const businessName = options?.businessName?.trim() || name;

            const hashedPassword = await this.hashPassword(password);
            const otp = this.generateOtp();
            const hashedOtp = await this.hashOtp(otp);
            const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

            logInfo("Registration OTP generated", {
                email,
                role: userRole,
                expiresAt: otpExpiresAt.toISOString(),
            });

            if (process.env.NODE_ENV !== "production") {
                console.log(`[DEV] Registration OTP for ${email}: ${otp}`);
            }

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
                { name, role: userRole },
            );

            const user = this.userRepository.create({
                email,
                password: hashedPassword,
                userType: userRole,
                verificationToken: hashedOtp,
                otpExpiresAt,
                isVerified: false,
                isActive: true,
            });
            const savedUser = await em.save(User, user);

            const profile = this.profileRepository.create({
                user_id: savedUser.id,
                username: ownerName,
                phone_number: normalizedPhone,
                business_name: userRole === UserRole.VENDOR ? businessName : null,
                is_business_verified: userRole === UserRole.VENDOR,
                profile_picture: this.randomProfileImage(),
            });
            await em.save(UserProfile, profile);

            if (userRole === UserRole.VENDOR) {
                if (!cityId) {
                    throw new AppError("City is required for hotel owner registration.", 400, ErrorCodes.VALIDATION_ERROR);
                }
                const businessProfile = await this.createOrUpdateVendorBusinessProfile(
                    em,
                    savedUser,
                    ownerName,
                    businessName,
                    normalizedPhone!,
                    cityId,
                );

                const currentPolicy = await this.vendorPolicyService.getCurrentPolicy();
                const acceptanceRepo = em.getRepository(PolicyAcceptance);
                await acceptanceRepo.save(
                    acceptanceRepo.create({
                        user_id: savedUser.id,
                        business_profile_id: businessProfile.id,
                        policy_type: currentPolicy.policyType,
                        policy_version: currentPolicy.policyVersion,
                        content_hash: currentPolicy.contentHash,
                        accepted_at: new Date(),
                    })
                );

                await this.ensureApprovedVendorCapability(em, savedUser);
                await this.createDraftHotelForVendor(em, savedUser, businessName, normalizedPhone!, cityId);
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

        const resetTokenId = crypto.randomBytes(32).toString("base64url");
        user.isVerified = true;
        user.verificationToken = undefined;
        user.otpExpiresAt = undefined;
        user.passwordResetJtiHash = this.hashResetTokenId(resetTokenId);
        await this.userRepository.save(user);

        await this.linkOrphanedBookings(user.id, user.email, this.userRepository.manager);

        logInfo(`OTP verified successfully for user: ${email}`);

        if (!CONFIG.jwt.resetSecret) {
            throw new Error("JWT_RESET_SECRET is not configured");
        }
        const resetToken = jwt.sign({
            email: user.email,
            purpose: PASSWORD_RESET_TOKEN_PURPOSE,
        }, CONFIG.jwt.resetSecret as string, {
            jwtid: resetTokenId,
            subject: user.id,
            issuer: PASSWORD_RESET_TOKEN_ISSUER,
            audience: PASSWORD_RESET_TOKEN_AUDIENCE,
            expiresIn: CONFIG.jwt.resetExpiresIn as any,
        });

        return { success: true, resetToken };
    }

    async resendOtp(email: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ["profile"],
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

        logInfo("Resend OTP generated", {
            email,
            expiresAt: otpExpiresAt.toISOString(),
        });

        if (process.env.NODE_ENV !== "production") {
            console.log(`\n================================`);
            console.log(`🔑 DEV RESEND OTP FOR ${email}: ${otp}`);
            console.log(`================================\n`);
        }

        user.verificationToken = hashedOtp;
        user.otpExpiresAt = otpExpiresAt;
        await this.userRepository.save(user);

        const username = this.profileUsername(user, email);

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
            { username },
        );
    }

    async login(email: string, password: string, meta: RefreshRequestMeta): Promise<ILoginResponseDto & { refreshToken: string }> {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ["profile"],
        });

        if (!user) {
            logError(new Error(`Login failed for email: ${email}`), "User login");
            throw new AppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS);
        }

        if (user.authProvider !== "local" || !user.password) {
            throw new AppError(
                "This account uses Google sign-in. Please sign in with Google.",
                401,
                ErrorCodes.INVALID_CREDENTIALS,
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
                ErrorCodes.EMAIL_NOT_VERIFIED,
            );
        }

        if (!user.isActive) {
            throw new AppError(
                user.userType === UserRole.VENDOR
                    ? "Your hotel owner account is pending admin approval."
                    : "Your account is inactive. Please contact support.",
                403,
                ErrorCodes.FORBIDDEN,
            );
        }

        const session = await this.issueSession(user, meta);

        logInfo(`User logged in successfully: ${email}`);
        return { token: session.accessToken, refreshToken: session.refreshToken };
    }

    async refreshSession(rawRefreshToken: string, meta: RefreshRequestMeta): Promise<IRefreshSessionResponseDto & { refreshToken: string }> {
        const parsed = this.parseRefreshToken(rawRefreshToken);
        if (!parsed) {
            throw new AppError("Invalid refresh token", 401, ErrorCodes.UNAUTHORIZED);
        }

        return this.userRepository.manager.transaction(async (manager) => {
            const refreshRepo = manager.getRepository(RefreshToken);
            const current = await refreshRepo.findOne({
                where: { id: parsed.id },
                relations: ["user", "user.profile"],
            });

            if (!current) {
                throw new AppError("Invalid refresh token", 401, ErrorCodes.UNAUTHORIZED);
            }

            if (current.revokedAt) {
                if (current.replacedByTokenId) {
                    await this.revokeRefreshFamily(manager, current.familyId);
                }
                throw new AppError("Refresh token has been revoked", 401, ErrorCodes.UNAUTHORIZED);
            }

            if (current.expiresAt.getTime() <= Date.now()) {
                current.revokedAt = new Date();
                await refreshRepo.save(current);
                throw new AppError("Refresh token has expired", 401, ErrorCodes.UNAUTHORIZED);
            }

            const expectedHash = this.hashRefreshTokenSecret(parsed.secret);
            if (expectedHash !== current.tokenHash) {
                await this.revokeRefreshFamily(manager, current.familyId);
                throw new AppError("Refresh token reuse detected", 401, ErrorCodes.UNAUTHORIZED);
            }

            const user = current.user;
            if (!user || !user.isActive) {
                current.revokedAt = new Date();
                await refreshRepo.save(current);
                throw new AppError("User is inactive", 401, ErrorCodes.UNAUTHORIZED);
            }

            const replacement = await this.issueRefreshToken(manager, user.id, meta, current.familyId);
            current.revokedAt = new Date();
            current.replacedByTokenId = replacement.entity.id;
            current.lastUsedAt = new Date();
            await refreshRepo.save(current);

            return {
                token: this.buildAccessToken(user),
                refreshToken: replacement.token,
            };
        });
    }

    async logout(rawRefreshToken?: string): Promise<void> {
        if (!rawRefreshToken) return;
        const parsed = this.parseRefreshToken(rawRefreshToken);
        if (!parsed) return;

        const refreshToken = await this.refreshTokenRepository.findOneBy({ id: parsed.id });
        if (!refreshToken) return;

        const expectedHash = this.hashRefreshTokenSecret(parsed.secret);
        if (refreshToken.tokenHash !== expectedHash) return;

        if (!refreshToken.revokedAt) {
            refreshToken.revokedAt = new Date();
            await this.refreshTokenRepository.save(refreshToken);
        }
    }

    async resetPassword(
        token: string,
        newPassword: string,
        confirmPassword: string,
    ): Promise<{ success: boolean }> {
        if (!token) {
            logError(new Error("Reset token missing"), "Password reset");
            throw new AppError("Reset token is required", 400, ErrorCodes.BAD_REQUEST);
        }
        if (!newPassword || !confirmPassword) {
            throw new AppError(
                "New password and confirm password are required",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }
        if (newPassword !== confirmPassword) {
            throw new AppError("Passwords do not match", 400, ErrorCodes.BAD_REQUEST);
        }
        if (newPassword.length < 8) {
            throw new AppError(
                "New password must be at least 8 characters long",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }

        let payload: PasswordResetTokenPayload;
        try {
            if (!CONFIG.jwt.resetSecret) {
                throw new Error("JWT reset secret is not configured");
            }
            const verified = jwt.verify(token, CONFIG.jwt.resetSecret as string, {
                algorithms: ["HS256"],
                issuer: PASSWORD_RESET_TOKEN_ISSUER,
                audience: PASSWORD_RESET_TOKEN_AUDIENCE,
            });
            if (
                typeof verified === "string"
                || verified.purpose !== PASSWORD_RESET_TOKEN_PURPOSE
                || typeof verified.email !== "string"
                || !verified.email.trim()
                || typeof verified.sub !== "string"
                || !verified.sub.trim()
                || typeof verified.jti !== "string"
                || !verified.jti.trim()
            ) {
                throw new Error("Password reset token claims are invalid");
            }
            payload = verified as PasswordResetTokenPayload;
        } catch (err) {
            logError(err as Error, "Password reset - Invalid token");
            throw new AppError("Invalid or expired reset token", 400, ErrorCodes.BAD_REQUEST);
        }

        const password = await this.hashPassword(newPassword);
        const result = await this.userRepository.update(
            {
                id: payload.sub,
                email: payload.email,
                passwordResetJtiHash: this.hashResetTokenId(payload.jti),
            },
            {
                password,
                isVerified: true,
                passwordResetJtiHash: null,
            },
        );
        if (result.affected !== 1) {
            throw new AppError("Invalid or already used reset token", 400, ErrorCodes.BAD_REQUEST);
        }
        await this.refreshTokenRepository
            .createQueryBuilder()
            .update(RefreshToken)
            .set({ revokedAt: new Date() })
            .where(`"user_id" = :userId`, { userId: payload.sub })
            .andWhere(`"revoked_at" IS NULL`)
            .execute();
        logInfo(`Password reset successfully for user: ${payload.sub}`);

        return { success: true };
    }

    async googleLoginOrRegister(
        accessToken: string,
        preferredUserRole: UserRole = UserRole.VENDOR,
        meta: RefreshRequestMeta,
    ): Promise<IGoogleLoginResponseDto & { refreshToken: string }> {
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
                ErrorCodes.INVALID_CREDENTIALS,
            );
        }

        const { email, sub: googleId, name: googleName, picture } = googleUser;

        let existingUser = await this.userRepository.findOne({
            where: [{ googleId }, { email }],
            relations: ["profile"],
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
                const saved = await em.save(User, newUser);

                const displayName = googleName ?? email.split("@")[0];
                const avatar = picture ?? this.randomProfileImage();

                const profile = this.profileRepository.create({
                    user_id: saved.id,
                    username: displayName,
                    profile_picture: avatar,
                });
                await em.save(UserProfile, profile);

                await this.linkOrphanedBookings(saved.id, email, em);

                logInfo(`New user registered via Google OAuth: ${email}`);
                return saved;
            });

            existingUser = (await this.userRepository.findOne({
                where: { id: existingUser.id },
                relations: ["profile"],
            }))!;
        } else if (!existingUser.googleId) {
            existingUser.googleId = googleId;
            if (!existingUser.isVerified) existingUser.isVerified = true;
            await this.userRepository.save(existingUser);
            logInfo(`Google account linked for existing user: ${email}`);
        }

        const session = await this.issueSession(existingUser, meta);

        return { token: session.accessToken, refreshToken: session.refreshToken, isNewUser };
    }

    async getCurrentUser(userId: string): Promise<ICurrentUserResponseDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["profile"],
        });

        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        const username = this.profileUsername(user);
        const businessProfileRepo = this.userRepository.manager.getRepository(BusinessProfile);
        const capabilityRepo = this.userRepository.manager.getRepository(BusinessCapability);
        const businessProfile = await businessProfileRepo.findOneBy({ user_id: userId });
        const approvedCapabilities = businessProfile
            ? await capabilityRepo.find({
                where: {
                    business_profile_id: businessProfile.id,
                    status: BusinessCapabilityStatus.APPROVED,
                },
                order: { created_at: "ASC" },
            })
            : [];

        let partnerAccessStatus: PartnerAccessStatus;
        if (user.userType === UserRole.ADMIN) {
            partnerAccessStatus = PartnerAccessStatus.ADMIN;
        } else if (businessProfile) {
            const profileStatusMap: Record<BusinessOnboardingStatus, PartnerAccessStatus> = {
                [BusinessOnboardingStatus.DRAFT]: PartnerAccessStatus.DRAFT,
                [BusinessOnboardingStatus.SUBMITTED]: PartnerAccessStatus.SUBMITTED,
                [BusinessOnboardingStatus.CHANGES_REQUESTED]: PartnerAccessStatus.CHANGES_REQUESTED,
                [BusinessOnboardingStatus.APPROVED]: PartnerAccessStatus.APPROVED,
                [BusinessOnboardingStatus.REJECTED]: PartnerAccessStatus.REJECTED,
                [BusinessOnboardingStatus.SUSPENDED]: PartnerAccessStatus.SUSPENDED,
            };
            partnerAccessStatus = profileStatusMap[businessProfile.onboarding_status];
        } else if (approvedCapabilities.length > 0 && user.isActive) {
            partnerAccessStatus = PartnerAccessStatus.APPROVED;
        } else if (user.userType === UserRole.VENDOR) {
            partnerAccessStatus = PartnerAccessStatus.DRAFT;
        } else {
            partnerAccessStatus = PartnerAccessStatus.CUSTOMER;
        }

        return {
            userId: user.id,
            email: user.email,
            username,
            userType: user.userType,
            vendorId: user.userType === UserRole.VENDOR ? user.id : undefined,
            businessProfileId: businessProfile?.id,
            onboardingStatus: businessProfile?.onboarding_status,
            partnerAccessStatus,
            approvedCapabilities: approvedCapabilities.map((capability) => capability.type),
        };
    }

    private async linkOrphanedBookings(userId: string, email: string, manager: EntityManager): Promise<void> {
        await manager.getRepository(HotelBooking).update(
            { guest_email: email, customer_user_id: IsNull() },
            { customer_user_id: userId },
        );
        logInfo(`Linked orphaned bookings for user: ${email} (${userId})`);
    }
}



