import { UserRole } from "@common/enums/user.enums";
import { BusinessCapabilityType, BusinessOnboardingStatus, PartnerAccessStatus } from "@common/enums/business.enums";

export interface IRegisterDto {
    email: string;
    password: string;
    userType?: UserRole;
    name: string;
    ownerName?: string;
    businessName?: string;
    phone?: string;
    cityId?: number;
}

export interface ILoginDto {
    email: string;
    password: string;
}

export interface IVerifyOtpDto {
    email: string;
    otp: string;
}

export interface IResendOtpDto {
    email: string;
}

export interface IResetPasswordDto {
    token: string;
    newPassword: string;
    confirmPassword: string;
}

export interface IGoogleVerifyDto {
    accessToken: string;
    userType?: 'vendor' | 'customer';
}

export interface ILoginResponseDto {
    token: string;
}

export interface IGoogleLoginResponseDto extends ILoginResponseDto {
    isNewUser: boolean;
}

export interface IRefreshSessionResponseDto extends ILoginResponseDto {}

export interface ICurrentUserResponseDto {
    userId: string;
    email: string;
    username: string;
    userType: UserRole;
    vendorId?: string;
    businessProfileId?: string;
    onboardingStatus?: BusinessOnboardingStatus;
    partnerAccessStatus: PartnerAccessStatus;
    approvedCapabilities: BusinessCapabilityType[];
}

export interface IAuthMessageResponseDto {
    message: string;
    resetToken?: string;
}
