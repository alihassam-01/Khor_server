import { UserType } from "@modules/user/entity/ENUM/enum";

export interface IRegisterDto {
    email: string;
    password: string;
    userType?: UserType;
    name: string;
    callBackUrl: string;
    phoneNumber?: string;
}

export interface ILoginDto {
    email: string;
    password: string;
}

export interface IVerifyEmailQuery {
    token: string;
}

export interface IResendVerificationEmailDto {
    email: string;
    callBackUrl: string;
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
