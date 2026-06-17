export enum AuditLogEventType {
    REGISTRATION_OTP = "registration_otp_email",
    RESEND_OTP = "resend_otp_email",
    FORGOT_PASSWORD_OTP = "forgot_password_otp_email",
    BOOKING_UPDATE = "booking_update_email",
    WHATSAPP_NOTIFICATION = "whatsapp_notification",
    ANALYTICS_REPORT = "analytics_report_email",
    CONTACT_US_FORWARD = "contact_us_forward",
    AD_ACTIVATION = "ad_activation_email",
    AD_EXPIRATION_WARNING = "ad_expiration_warning_email",
    AD_EXPIRED = "ad_expired_email",
    TICKET_ACTIVITY = "ticket_activity_email",
    OWNER_DAILY_CHECKINS = "owner_daily_checkins_email",
    PARTNER_APPROVAL = "partner_approval_email",
    VENDOR_POLICY_UPDATE = "vendor_policy_update_email",
}

export enum AuditLogStatus {
    SUCCESS = "success",
    FAILED = "failed",
}

export const EMAIL_SUBJECTS: Record<string, string> = {
    REGISTRATION_OTP: "Your Khor Verification Code",
    RESEND_OTP: "Your New Khor Verification Code",
    FORGOT_PASSWORD_OTP: "Password Reset OTP",
    BOOKING_UPDATE: "Booking Update",
    ANALYTICS_REPORT: "Your Ad Performance Report",
    AD_ACTIVATION: "Your Ad is Now Live!",
    AD_EXPIRATION_WARNING: "Your Ad is About to Expire",
    AD_EXPIRED: "Your Ad has Expired",
    TICKET_ACTIVITY: "Ticket Update",
    PARTNER_APPROVAL: "Your Partner Account is Approved",
    VENDOR_POLICY_UPDATE: "Vendor Policy Updated",
};
