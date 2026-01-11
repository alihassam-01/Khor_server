export const EmailConfig = {
  provider: process.env.EMAIL_PROVIDER || "smtp",

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.MAIL_FROM,
  },

  ses: {
    region: process.env.AWS_SES_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    from: process.env.SES_FROM,
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    fromEmail: process.env.BREVO_FROM_EMAIL || "travelbalti@gmail.com",
    fromName: process.env.BREVO_FROM_NAME || "Khor",
  },
};
