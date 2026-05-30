export enum AuditLogEventType {
    REGISTRATION_OTP = "registration_otp_email",
    RESEND_OTP = "resend_otp_email",
    FORGOT_PASSWORD_OTP = "forgot_password_otp_email",
    BOOKING_CONFIRMATION = "booking_confirmation_email",
    BOOKING_UPDATE = "booking_update_email",
    ANALYTICS_REPORT = "analytics_report_email",
    CONTACT_US_FORWARD = "contact_us_forward",
    ACCOUNT_ACTIVATION = "account_activation_email",
    AD_ACTIVATION = "ad_activation_email",
    AD_EXPIRATION_WARNING = "ad_expiration_warning_email",
    AD_EXPIRED = "ad_expired_email",
}

export enum AuditLogStatus {
    SUCCESS = "success",
    FAILED = "failed",
}

export const EMAIL_SUBJECTS: Record<string, string> = {
    REGISTRATION_OTP: "Your Khor Verification Code",
    RESEND_OTP: "Your New Khor Verification Code",
    FORGOT_PASSWORD_OTP: "Password Reset OTP",
    BOOKING_CONFIRMATION: "Booking Confirmation",
    BOOKING_UPDATE: "Booking Update",
    ANALYTICS_REPORT: "Your Ad Performance Report",
    ACCOUNT_ACTIVATION: "Activate Your Account",
    AD_ACTIVATION: "Your Ad is Now Live!",
    AD_EXPIRATION_WARNING: "Your Ad is About to Expire",
    AD_EXPIRED: "Your Ad has Expired",
};
