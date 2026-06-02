import { UserRole } from "@common/enums/user.enums";

export interface IRegisterDto {
    email: string;
    password: string;
    userType?: UserRole;
    name: string;
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

export interface ICurrentUserResponseDto {
    userId: string;
    email: string;
    username: string;
    userType: UserRole;
    vendorId?: string;
}

export interface IAuthMessageResponseDto {
    message: string;
    resetToken?: string;
}
