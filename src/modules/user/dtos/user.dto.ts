import { UserRole } from "@common/enums/user.enums";

export interface IPassData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  userId: string;
}

export interface IVendorProfileDTO {
    id: string; // Changed to string for UUID
    username: string;
    phone_number?: string;
    profile_picture?: string;
    // address and bio removed as they are not in the current Vendor entity
}

export interface ICustomerProfileDTO {
    id: string; // Changed to string for userId/UUID
    username: string;
    phone_number?: string;
    profile_picture?: string;
}

export interface IUserResponseDto {
  id: string;
  isActive: boolean;
  isVerified: boolean;
  email: string;
  userType: UserRole;
  createdAt: Date;
  profile?: IVendorProfileDTO | ICustomerProfileDTO | null;
}

export interface IUserProfileDto {
  isActive: boolean;
  isVerified: boolean;
  email: string;
  userType: UserRole;
  createdAt: Date;
  profilePicture?: string;
  username?: string;
  phoneNumber?: string;
}

export interface IVendorListItemDTO {
    id: string;
    userId: string;
    vendorProfileId?: string; // Changed to string for UUID
    isActive: boolean;
    isVerified: boolean;
    isBusinessVerified?: boolean;
    email: string;
    username?: string;
    businessName?: string;
    profile_picture?: string;
    phone_number?: string;
    createdAt: Date;
}

export interface ICustomerListItemDTO {
    id: string;
    isActive: boolean;
    isVerified: boolean;
    email: string;
    customer?: ICustomerProfileDTO | null;
    createdAt: Date;
}

export interface IUpdateUserResponseDto extends IUserProfileDto {}

export interface IDeleteUserResponseDto {
  success: boolean;
  message: string;
}
