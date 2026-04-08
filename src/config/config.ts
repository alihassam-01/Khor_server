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
    salt: process.env.SALT || "defaultsalt"
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
};
