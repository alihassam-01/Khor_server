import { IsNull, Not } from "typeorm";
import { AppDataSource } from "@config/ormconfig";
import { CustomerProfile, User } from "@modules/user/entity/user";
import { Vendor } from "@modules/user/entity";
import { IPassData } from "@modules/user/dtos/user.dto";
import { AuthService } from "./auth.service";
import { forgotPasswordTemplate } from "./email/templates/forgotPassword";
import * as jwt from "jsonwebtoken";
import { UserType } from "@modules/user/entity/ENUM/enum";

import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../../../constant/error";
import { sendEmail } from "./email";
import { CONFIG } from "@config/config";
import { logInfo } from "@lib/logger";
export class UserService {
  async forgotPassword(email: string) {
    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      return;
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET environment variable is not defined.");
    }
    const resetToken = jwt.sign({ email }, CONFIG.jwt.secret as string, {
      expiresIn: "24h",
    });

    const resetLink = `${CONFIG.web_domain.url}/reset-password?token=${resetToken}`;

    const name =
      user.userType === UserType.VENDOR
        ? user.vendor?.username
        : user.customerProfile?.username;
    await sendEmail({
      to: email,
      subject: "Reset Password",
      html: forgotPasswordTemplate(name as string, resetLink),
    });
    logInfo(`Password reset email sent to ${email}`);
    return;
  }
  private userRepository = AppDataSource.getRepository(User);
  private vendorRepo = AppDataSource.getRepository(Vendor);
  private customerRepo = AppDataSource.getRepository(CustomerProfile);
  private authService = new AuthService(
    this.userRepository,
    this.vendorRepo,
    this.customerRepo
  );

  async getUserById(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        vendor: true,
        customerProfile: true,
      },
    });
    if (!user) {
      throw new Error("User not found");
    }
    return {
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      userType: user.userType,
      createdAt: user.createdAt,
      profilePicture:
        user.userType === UserType.VENDOR
          ? user.vendor?.profile_picture
          : user.customerProfile?.profile_picture,
      username:
        user.userType === UserType.VENDOR
          ? user.vendor?.username
          : user.customerProfile?.username,
      phoneNumber:
        user.userType === UserType.VENDOR
          ? user.vendor?.phone_number
          : user.customerProfile?.phone_number,
    };
  }

  async getUsers() {
    const users = await this.userRepository.find({
      relations: {
        customerProfile: true,
        vendor: true,
      },
    });
    // get the customer_profile and vendor

    return users.map((user) => ({
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      userType: user.userType,
      createdAt: user.createdAt,
      profile:
        user.userType === UserType.CUSTOMER ? user.customerProfile : user.vendor,
    }));
  }

  async getCustomers() {
    const users = await this.userRepository.find({
      where: {
        isActive: true,
        customerProfile: Not(IsNull()),
      },
      relations: {
        customerProfile: true,
      },
    });
    return users.map((user) => ({
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      customer: user.customerProfile,
      createdAt: user.createdAt,
    }));
  }

  async getVendors() {
    const users = await this.userRepository.find({
      where: {
        isActive: true,
        vendor: { id: Not(IsNull()) },
      },
      relations: {
        vendor: true,
      },
    });

    return users.map((user) => ({
      userId: user.id,             // ← Use this for hotel.vendor_id
      vendorProfileId: user.vendor?.id,  // For reference
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      username: user.vendor?.username,
      profile_picture: user.vendor?.profile_picture,
      phone_number: user.vendor?.phone_number,
      createdAt: user.createdAt,
    }));
  }

  async updateUser(userId: string, updateData: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }
    if (user?.userType === UserType.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { user: { id: user.id } },
      });
      if (vendor) {
        if (updateData.phoneNumber != null && updateData.phoneNumber !== "") {
          vendor.phone_number = updateData.phoneNumber;
        }
        // if (updateData.username != null && updateData.username !== "") {
        //   vendor.username = updateData.username;
        // }
        if (updateData.profilePicture != null && updateData.profilePicture !== "") {
          vendor.profile_picture = updateData.profilePicture;
        }
        await this.vendorRepo.save(vendor);
      }
    } else if (user?.userType === UserType.CUSTOMER) {
      const customer = await this.customerRepo.findOne({
        where: { user: { id: user.id } },
      });
      if (customer) {
        if (updateData.phoneNumber != null && updateData.phoneNumber !== "") {
          customer.phone_number = updateData.phoneNumber;
        }
        // if (updateData.username != null && updateData.username !== "") {
        //   customer.username = updateData.username;
        // }
        if (updateData.profilePicture != null && updateData.profilePicture !== "") {
          customer.profile_picture = updateData.profilePicture;
        }
        await this.customerRepo.save(customer);
      }
    }
    return this.getUserById(user.id);
  }

  async updatePassword(passData: IPassData) {
    const { userId, currentPassword, newPassword, confirmPassword } = passData;

    // Validation
    if (!userId || !currentPassword || !newPassword || !confirmPassword) {
      throw new ValidationError("All fields are required.");
    }

    // Validate UUID format for userId
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new ValidationError("Invalid user ID format.");
    }

    if (newPassword !== confirmPassword) {
      throw new ValidationError(
        "New password and confirm password do not match."
      );
    }

    // Password strength validation
    if (newPassword.length < 8) {
      throw new ValidationError(
        "New password must be at least 8 characters long."
      );
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new ValidationError(
        "New password must contain at least one uppercase letter, one lowercase letter, and one number."
      );
    }

    // Find user
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    if (!user.password) {
      throw new ValidationError("This account uses Google sign-in and does not have a password. Use 'Forgot Password' to set one.");
    }

    // Verify current password (assuming passwords are hashed)
    const isMatch = await this.authService.comparePassword(
      currentPassword,
      user.password
    );
    if (!isMatch) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    // Check if new password is same as current
    const isSamePassword = await this.authService.comparePassword(
      newPassword,
      user.password
    );
    if (isSamePassword) {
      throw new ValidationError(
        "New password must be different from current password."
      );
    }

    // Update password
    user.password = await this.authService.hashPassword(newPassword);
    await this.userRepository.save(user);
    logInfo(`Password updated successfully for user: ${userId}`);

    return { success: true, message: "Password updated successfully." };
  }
}
