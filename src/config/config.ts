// src/config/config.ts

import * as dotenv from "dotenv";

dotenv.config();  // Load environment variables from .env

export const config = {
  db: {
    type: process.env.DB_TYPE || "postgres",
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "pass123",
    database: process.env.DB_NAME || "khor_server",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "defaultsecretkey",
    salt: process.env.salt || "defaultsalt"
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
  web_domain:{
    url: process.env.WEB_DOMAIN,
  }
};
