import { IsNull, Not, Repository } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import { CustomerProfile, User } from "@modules/user/entity/user";
import { Vendor } from "@modules/user/entity/business/vendor-entity";
import { 
    IPassData, 
    IUserResponseDto, 
    IUserProfileDto, 
    IDeleteUserResponseDto,
    IVendorListItemDTO,
    ICustomerListItemDTO,
    IVendorProfileDTO,
    ICustomerProfileDTO
} from "@modules/user/dtos";
import { AuthService } from "./auth.service";
import { forgotPasswordTemplate } from "./email/templates/forgotPassword";
// import * as jwt from "jsonwebtoken";
import { UserRole } from "@common/enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { sendEmail } from "./email";
// import { CONFIG } from "@config/config";
import { logInfo } from "@lib/logger";

export class UserService {
  private userRepository: Repository<User> = AppDataSource.getRepository(User);
  private vendorRepo: Repository<Vendor> = AppDataSource.getRepository(Vendor);
  private customerRepo: Repository<CustomerProfile> = AppDataSource.getRepository(CustomerProfile);
  private authService = new AuthService(
    this.userRepository,
    this.vendorRepo,
    this.customerRepo
  );

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email }, relations: ['vendor', 'customerProfile'] });
    if (!user) {
      return;
    }

    const otp = this.authService.generateOtp();
    console.log(`[USER] Generated forgot password OTP for ${email}: ${otp}`);
    const hashedOtp = await this.authService.hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.verificationToken = hashedOtp;
    user.otpExpiresAt = otpExpiresAt;
    await this.userRepository.save(user);

    const name =
      user.userType === UserRole.VENDOR
        ? user.vendor?.username
        : user.customerProfile?.username;
        
    await sendEmail({
      to: email,
      subject: "Password Reset OTP",
      html: forgotPasswordTemplate(name || "User", otp),
    });
    
    logInfo(`Password reset OTP email sent to ${email}`);
    return;
  }

  async getUserById(userId: string): Promise<IUserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        vendor: true,
        customerProfile: true,
      },
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
      profilePicture:
        user.userType === UserRole.VENDOR
          ? user.vendor?.profile_picture
          : user.customerProfile?.profile_picture,
      username:
        user.userType === UserRole.VENDOR
          ? user.vendor?.username
          : user.customerProfile?.username,
      phoneNumber:
        user.userType === UserRole.VENDOR
          ? user.vendor?.phone_number
          : user.customerProfile?.phone_number,
    };
  }

  async getUsers(): Promise<IUserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: {
        customerProfile: true,
        vendor: true,
      },
    });

    return users.map((user) => {
        let profile: IVendorProfileDTO | ICustomerProfileDTO | null = null;
        if (user.userType === UserRole.CUSTOMER && user.customerProfile) {
            profile = {
                id: user.customerProfile.userId, // Use userId for CustomerProfile
                username: user.customerProfile.username,
                phone_number: user.customerProfile.phone_number,
                profile_picture: user.customerProfile.profile_picture
            };
        } else if (user.userType === UserRole.VENDOR && user.vendor) {
            profile = {
                id: user.vendor.id, // Use id (UUID string) for Vendor
                username: user.vendor.username || "",
                phone_number: user.vendor.phone_number,
                profile_picture: user.vendor.profile_picture
            };
        }

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
      where: {
        isActive: true,
        userType: UserRole.CUSTOMER,
        customerProfile: Not(IsNull()),
      },
      relations: {
        customerProfile: true,
      },
    });
    return users.map((user) => ({
      id: user.id,
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      customer: user.customerProfile ? {
          id: user.customerProfile.userId, // Use userId
          username: user.customerProfile.username,
          phone_number: user.customerProfile.phone_number,
          profile_picture: user.customerProfile.profile_picture
      } : null,
      createdAt: user.createdAt,
    }));
  }

  async getVendors(): Promise<IVendorListItemDTO[]> {
    const users = await this.userRepository.find({
      where: {
        isActive: true,
        userType: UserRole.VENDOR,
        vendor: { id: Not(IsNull()) },
      },
      relations: {
        vendor: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      userId: user.id,
      vendorProfileId: user.vendor?.id, // This is a UUID string
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      username: user.vendor?.username,
      profile_picture: user.vendor?.profile_picture,
      phone_number: user.vendor?.phone_number,
      createdAt: user.createdAt,
    }));
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

  async changeRole(userId: string, newRole: UserRole): Promise<IUserProfileDto | { success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["vendor", "customerProfile"],
    });

    if (!user) {
      throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
    }

    if (user.userType === newRole) {
      return { success: true, message: "User is already assigned this role." };
    }

    if (newRole === UserRole.VENDOR && !user.vendor) {
      const vendor = this.vendorRepo.create({
        user,
        username: user.customerProfile?.username || "New Vendor",
        profile_picture: user.customerProfile?.profile_picture || undefined,
      });
      await this.vendorRepo.save(vendor);
    } 
    else if (newRole === UserRole.CUSTOMER && !user.customerProfile) {
      const customer = this.customerRepo.create({
        user,
        username: user.vendor?.username || "New Customer",
        profile_picture: user.vendor?.profile_picture || undefined,
      });
      await this.customerRepo.save(customer);
    }

    user.userType = newRole;
    await this.userRepository.save(user);

    logInfo(`User role updated successfully for ${userId} to ${newRole}`);
    return this.getUserById(user.id);
  }

  async updateUser(userId: string, updateData: { phoneNumber?: string; profilePicture?: string }): Promise<IUserProfileDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
    }
    if (user?.userType === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { user: { id: user.id } },
      });
      if (vendor) {
        if (updateData.phoneNumber != null && updateData.phoneNumber !== "") {
          vendor.phone_number = updateData.phoneNumber;
        }
        if (updateData.profilePicture != null && updateData.profilePicture !== "") {
          vendor.profile_picture = updateData.profilePicture;
        }
        await this.vendorRepo.save(vendor);
      }
    } else if (user?.userType === UserRole.CUSTOMER) {
      const customer = await this.customerRepo.findOne({
        where: { user: { id: user.id } },
      });
      if (customer) {
        if (updateData.phoneNumber != null && updateData.phoneNumber !== "") {
          customer.phone_number = updateData.phoneNumber;
        }
        if (updateData.profilePicture != null && updateData.profilePicture !== "") {
          customer.profile_picture = updateData.profilePicture;
        }
        await this.customerRepo.save(customer);
      }
    }
    return this.getUserById(user.id);
  }

  async updatePassword(passData: IPassData): Promise<{ success: boolean; message: string }> {
    const { userId, currentPassword, newPassword, confirmPassword } = passData;

    if (!userId || !currentPassword || !newPassword || !confirmPassword) {
      throw new AppError("All fields are required.", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new AppError("Invalid user ID format.", 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError(
        "New password and confirm password do not match.", 400, ErrorCodes.VALIDATION_ERROR
      );
    }

    if (newPassword.length < 8) {
      throw new AppError(
        "New password must be at least 8 characters long.", 400, ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new AppError(
        "New password must contain at least one uppercase letter, one lowercase letter, and one number.", 400, ErrorCodes.VALIDATION_ERROR
      );
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError("User not found.", 404, ErrorCodes.NOT_FOUND);
    }

    if (!user.password) {
      throw new AppError("This account uses Google sign-in and does not have a password. Use 'Forgot Password' to set one.", 400, ErrorCodes.BAD_REQUEST);
    }

    const isMatch = await this.authService.comparePassword(
      currentPassword,
      user.password
    );
    if (!isMatch) {
      throw new AppError("Current password is incorrect.", 401, ErrorCodes.UNAUTHORIZED);
    }

    const isSamePassword = await this.authService.comparePassword(
      newPassword,
      user.password
    );
    if (isSamePassword) {
      throw new AppError(
        "New password must be different from current password.", 400, ErrorCodes.VALIDATION_ERROR
      );
    }

    user.password = await this.authService.hashPassword(newPassword);
    await this.userRepository.save(user);
    logInfo(`Password updated successfully for user: ${userId}`);

    return { success: true, message: "Password updated successfully." };
  }
}
