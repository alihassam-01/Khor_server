import * as dotenv from "dotenv";

dotenv.config();  // Load environment variables from .env

export const CONFIG = {
  env: process.env.NODE_ENV || 'development',
  db: {
    url: process.env.DATABASE_URL, // Single connection string (preferred)
    type: process.env.DB_TYPE || "postgres",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "pass123",
    database: process.env.DB_NAME || "khor_server",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "defaultsecretkey",
    salt: process.env.SALT || "defaultsalt",
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN || "24h"
  },
  smtp: {
    server: process.env.SMTP_SERVER || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    email: process.env.SMTP_EMAIL || "",
    apiKey: process.env.SMTP_API_KEY || "",
    name: process.env.SMTP_NAME || "Khor",
  },
  web_domain: {
    url: process.env.WEB_DOMAIN,
  },
  api_domain: {
    url: process.env.API_PUBLIC_URL || "",
  },
  admin_domain: {
    url: process.env.ADMIN_DOMAIN || "https://admin.gokhor.com",
  },
  partner_domain: {
    url: process.env.PARTNER_DOMAIN || "http://127.0.0.1:9014",
  },
  payfast: {
    merchantId: process.env.PAYFAST_MERCHANT_ID || "",
    securedKey: process.env.PAYFAST_SECURED_KEY || "",
    merchantName: process.env.PAYFAST_MERCHANT_NAME || "Khor",
    currencyCode: process.env.PAYFAST_CURRENCY_CODE || "PKR",
    version: process.env.PAYFAST_VERSION || "MERCHANTCART-0.1",
    transactionType: process.env.PAYFAST_TRANSACTION_TYPE || "ECOMM_PURCHASE",
    procCode: process.env.PAYFAST_PROC_CODE || "00",
    storeId: process.env.PAYFAST_STORE_ID || "",
    signature: process.env.PAYFAST_SIGNATURE || "",
    accessTokenUrl: process.env.PAYFAST_ACCESS_TOKEN_URL || "https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken",
    checkoutPostUrl: process.env.PAYFAST_CHECKOUT_POST_URL || "https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction",
    transactionStatusUrl: process.env.PAYFAST_TRANSACTION_STATUS_URL || "https://ipguat.apps.net.pk/Ecommerce/api/transaction",
    transactionStatusByBasketUrl: process.env.PAYFAST_TRANSACTION_STATUS_BY_BASKET_URL || "",
    checkoutHoldMinutes: Number(process.env.PAYFAST_CHECKOUT_HOLD_MINUTES) || 30,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  server: {
    port: Number(process.env.PORT) || 5000,
    host: process.env.SERVER_HOST || "localhost",
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_BUCKET_NAME || "",
    publicUrl: process.env.R2_PUBLIC_URL || "",
    maxFileSize: Number(process.env.R2_MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  otp: {
    expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
    resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
  },
  notifications: {
    processRole: process.env.PROCESS_ROLE
      || (process.env.NODE_ENV === "production" ? "api" : "all"),
    timezone: process.env.NOTIFICATION_TIMEZONE || "Asia/Karachi",
    whatsappEnabled: process.env.WHATSAPP_NOTIFICATIONS_ENABLED === "true",
    whatsappBookingLifecycleEnabled: process.env.WHATSAPP_BOOKING_LIFECYCLE_ENABLED === "true",
    whatsappOwnerCheckInDigestEnabled: process.env.WHATSAPP_OWNER_CHECKIN_DIGEST_ENABLED === "true",
    whatsappAdapterUrl: process.env.WHATSAPP_ADAPTER_URL || "http://127.0.0.1:3000",
    whatsappAdapterToken: process.env.WHATSAPP_ADAPTER_TOKEN || "",
    whatsappTimeoutMs: Number(process.env.WHATSAPP_ADAPTER_TIMEOUT_MS) || 15_000,
    workerBatchSize: Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE) || 20,
    workerMaxAttempts: Number(process.env.NOTIFICATION_WORKER_MAX_ATTEMPTS) || 5,
  },
};
