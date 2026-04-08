import { UserType } from "@modules/user/entity/ENUM/enum";

export interface IRegisterDto {
    email: string;
    password: string;
    userType?: UserType;
    name: string;
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
