import { CONFIG } from "@config/config";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = CONFIG.otp.expiryMinutes;
export const OTP_RESEND_COOLDOWN_SECONDS = CONFIG.otp.resendCooldownSeconds;
