import { Repository } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import {
    IPassData,
    IUserResponseDto,
    IUserProfileDto,
    IDeleteUserResponseDto,
    IVendorListItemDTO,
    ICustomerListItemDTO,
    IVendorProfileDTO,
    ICustomerProfileDTO,
} from "@modules/user/dtos";
import { AuthService } from "./auth.service";
import { forgotPasswordTemplate } from "./email/templates/forgotPassword";
import { UserRole } from "@common/enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { sendEmail } from "./email";
import { logInfo } from "@lib/logger";
import {
    EMAIL_SUBJECTS,
    AuditLogStatus,
    AuditLogEventType,
} from "../constant/audit.constant";
import { AuditLogService } from "./audit-log.service";
import { Listing } from "@modules/user/entity/listing";
import { ListingStatus, ListingType } from "@common/enums/listing.enums";

export class UserService {
    private auditLogService = new AuditLogService();
    private userRepository: Repository<User> = AppDataSource.getRepository(User);
    private profileRepository: Repository<UserProfile> = AppDataSource.getRepository(UserProfile);
    private listingRepository: Repository<Listing> = AppDataSource.getRepository(Listing);
    private authService = new AuthService(this.userRepository, this.profileRepository);

    private profileNameOf(user: User): string {
        return user.profile?.username || user.email.split("@")[0] || "Unknown User";
    }

    private async ensureProfile(user: User, fallbackName?: string): Promise<UserProfile> {
        if (user.profile) return user.profile;
        const profile = this.profileRepository.create({
            user_id: user.id,
            username: fallbackName || user.email.split("@")[0] || "User",
        });
        return this.profileRepository.save(profile);
    }

    async forgotPassword(email: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { email },
            relations: ["profile"],
        });
        if (!user) {
            return;
        }

        const otp = this.authService.generateOtp();
        const hashedOtp = await this.authService.hashOtp(otp);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.verificationToken = hashedOtp;
        user.otpExpiresAt = otpExpiresAt;
        await this.userRepository.save(user);

        const name = this.profileNameOf(user);

        const success = await sendEmail({
            to: email,
            subject: EMAIL_SUBJECTS.FORGOT_PASSWORD_OTP,
            html: forgotPasswordTemplate(name, otp),
        });

        await this.auditLogService.log(
            AuditLogEventType.FORGOT_PASSWORD_OTP,
            email,
            success ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILED,
            success ? undefined : "Email service returned failure",
            { name },
        );
    }

    async getUserById(userId: string): Promise<IUserProfileDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["profile"],
        });
        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        return {
            isActive: user.isActive,
            isVerified: user.isVerified,
            email: user.email,
            userType: user.userType,
            createdAt: user.createdAt,
            profilePicture: user.profile?.profile_picture || undefined,
            username: this.profileNameOf(user),
            phoneNumber: user.profile?.phone_number || undefined,
        };
    }

    async getUsers(): Promise<IUserResponseDto[]> {
        const users = await this.userRepository.find({ relations: ["profile"] });

        return users.map((user) => {
            const fallback = user.email.split("@")[0] || "Unknown User";
            // The DTO union type is `IVendorProfileDTO | ICustomerProfileDTO`
            // — they're structurally identical, so the same shape works for both.
            const profile: IVendorProfileDTO | ICustomerProfileDTO = {
                id: user.id,
                username: user.profile?.username || fallback,
                phone_number: user.profile?.phone_number || undefined,
                profile_picture: user.profile?.profile_picture || undefined,
            };

            return {
                id: user.id,
                isActive: user.isActive,
                isVerified: user.isVerified,
                email: user.email,
                userType: user.userType,
                createdAt: user.createdAt,
                profile,
            };
        });
    }

    async getCustomers(): Promise<ICustomerListItemDTO[]> {
        const users = await this.userRepository.find({
            where: { isActive: true, userType: UserRole.CUSTOMER },
            relations: ["profile"],
        });
        return users.map((user) => ({
            id: user.id,
            isActive: user.isActive,
            isVerified: user.isVerified,
            email: user.email,
            customer: {
                id: user.id,
                username: user.profile?.username || user.email.split("@")[0] || "Unknown User",
                phone_number: user.profile?.phone_number || undefined,
                profile_picture: user.profile?.profile_picture || undefined,
            },
            createdAt: user.createdAt,
        }));
    }

    async getVendors(): Promise<IVendorListItemDTO[]> {
        const users = await this.userRepository.find({
            where: { isActive: true, userType: UserRole.VENDOR },
            relations: ["profile"],
            order: { createdAt: "DESC" },
        });

        return users.map((user) => ({
            id: user.id,
            userId: user.id,
            // Legacy field — in the unified profile model the "vendor profile id"
            // collapses onto the user id. Frontends that read this field still
            // see the same value via either name.
            vendorProfileId: user.id,
            isActive: user.isActive,
            isVerified: user.isVerified,
            isBusinessVerified: user.profile?.is_business_verified ?? false,
            email: user.email,
            username: user.profile?.username || user.email.split("@")[0] || "Unknown Vendor",
            businessName: user.profile?.business_name || undefined,
            profile_picture: user.profile?.profile_picture || undefined,
            phone_number: user.profile?.phone_number || undefined,
            createdAt: user.createdAt,
        }));
    }

    async getHotelOwners(): Promise<IVendorListItemDTO[]> {
        const users = await this.userRepository.find({
            where: { userType: UserRole.VENDOR },
            relations: ["profile"],
            order: { createdAt: "DESC" },
        });

        return users.map((user) => ({
            id: user.id,
            userId: user.id,
            vendorProfileId: user.id,
            isActive: user.isActive,
            isVerified: user.isVerified,
            isBusinessVerified: user.profile?.is_business_verified ?? false,
            email: user.email,
            username: user.profile?.username || user.email.split("@")[0] || "Unknown Vendor",
            businessName: user.profile?.business_name || undefined,
            profile_picture: user.profile?.profile_picture || undefined,
            phone_number: user.profile?.phone_number || undefined,
            createdAt: user.createdAt,
        }));
    }

    async approveHotelOwner(userId: string): Promise<IVendorListItemDTO> {
        const user = await this.userRepository.findOne({
            where: { id: userId, userType: UserRole.VENDOR },
            relations: ["profile"],
        });

        if (!user) {
            throw new AppError("Hotel owner not found", 404, ErrorCodes.NOT_FOUND);
        }

        const profile = await this.ensureProfile(user);
        user.isActive = true;
        profile.is_business_verified = true;
        if (!profile.business_name) {
            profile.business_name = profile.username;
        }

        await this.userRepository.save(user);
        await this.profileRepository.save(profile);
        await this.listingRepository.update(
            { vendor_id: user.id, type: ListingType.HOTEL },
            { is_active: true, status: ListingStatus.ACTIVE },
        );

        logInfo(`Hotel owner approved: ${userId}`);
        return {
            id: user.id,
            userId: user.id,
            vendorProfileId: user.id,
            isActive: user.isActive,
            isVerified: user.isVerified,
            isBusinessVerified: profile.is_business_verified,
            email: user.email,
            username: profile.username,
            businessName: profile.business_name || undefined,
            profile_picture: profile.profile_picture || undefined,
            phone_number: profile.phone_number || undefined,
            createdAt: user.createdAt,
        };
    }

    async suspendHotelOwner(userId: string): Promise<IVendorListItemDTO> {
        const user = await this.userRepository.findOne({
            where: { id: userId, userType: UserRole.VENDOR },
            relations: ["profile"],
        });

        if (!user) {
            throw new AppError("Hotel owner not found", 404, ErrorCodes.NOT_FOUND);
        }

        const profile = await this.ensureProfile(user);
        user.isActive = false;
        profile.is_business_verified = false;
        await this.userRepository.save(user);
        await this.profileRepository.save(profile);
        await this.listingRepository.update(
            { vendor_id: user.id, type: ListingType.HOTEL },
            { is_active: false, status: ListingStatus.INACTIVE },
        );

        logInfo(`Hotel owner suspended: ${userId}`);
        return {
            id: user.id,
            userId: user.id,
            vendorProfileId: user.id,
            isActive: user.isActive,
            isVerified: user.isVerified,
            isBusinessVerified: profile.is_business_verified,
            email: user.email,
            username: profile.username,
            businessName: profile.business_name || undefined,
            profile_picture: profile.profile_picture || undefined,
            phone_number: profile.phone_number || undefined,
            createdAt: user.createdAt,
        };
    }

    async deleteUser(userId: string): Promise<IDeleteUserResponseDto> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }
        user.isActive = false;
        await this.userRepository.save(user);
        logInfo(`User deleted (soft) successfully: ${userId}`);
        return { success: true, message: "User deleted successfully" };
    }

    async changeRole(
        userId: string,
        newRole: UserRole,
    ): Promise<IUserProfileDto | { success: boolean; message: string }> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["profile"],
        });

        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        await this.ensureProfile(user);

        if (user.userType !== newRole) {
            user.userType = newRole;
            await this.userRepository.save(user);
            logInfo(`User role updated successfully for ${userId} to ${newRole}`);
        }

        return this.getUserById(user.id);
    }

    async updateUser(
        userId: string,
        updateData: { phoneNumber?: string; profilePicture?: string; username?: string },
    ): Promise<IUserProfileDto> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ["profile"],
        });
        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        const profile = await this.ensureProfile(user);
        if (updateData.phoneNumber != null && updateData.phoneNumber !== "") {
            if (!/^\+?[0-9]+$/.test(updateData.phoneNumber)) {
                throw new AppError(
                    "Invalid phone number format",
                    400,
                    ErrorCodes.VALIDATION_ERROR,
                );
            }
            profile.phone_number = updateData.phoneNumber;
        }
        if (updateData.profilePicture != null && updateData.profilePicture !== "") {
            profile.profile_picture = updateData.profilePicture;
        }
        if (updateData.username != null && updateData.username !== "") {
            profile.username = updateData.username;
        }
        await this.profileRepository.save(profile);

        return this.getUserById(user.id);
    }

    async updatePassword(passData: IPassData): Promise<{ success: boolean; message: string }> {
        const { userId, currentPassword, newPassword, confirmPassword } = passData;

        if (!userId || !currentPassword || !newPassword || !confirmPassword) {
            throw new AppError("All fields are required.", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            throw new AppError("Invalid user ID format.", 400, ErrorCodes.VALIDATION_ERROR);
        }

        if (newPassword !== confirmPassword) {
            throw new AppError(
                "New password and confirm password do not match.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        if (newPassword.length < 8) {
            throw new AppError(
                "New password must be at least 8 characters long.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
            throw new AppError(
                "New password must contain at least one uppercase letter, one lowercase letter, and one number.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new AppError("User not found.", 404, ErrorCodes.NOT_FOUND);
        }

        if (!user.password) {
            throw new AppError(
                "This account uses Google sign-in and does not have a password. Use 'Forgot Password' to set one.",
                400,
                ErrorCodes.BAD_REQUEST,
            );
        }

        const isMatch = await this.authService.comparePassword(currentPassword, user.password);
        if (!isMatch) {
            throw new AppError("Current password is incorrect.", 401, ErrorCodes.UNAUTHORIZED);
        }

        const isSamePassword = await this.authService.comparePassword(newPassword, user.password);
        if (isSamePassword) {
            throw new AppError(
                "New password must be different from current password.",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }

        user.password = await this.authService.hashPassword(newPassword);
        await this.userRepository.save(user);
        logInfo(`Password updated successfully for user: ${userId}`);

        return { success: true, message: "Password updated successfully." };
    }
}
