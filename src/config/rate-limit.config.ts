import { FastifyRequest } from "fastify";

type EmailBody = {
  email?: unknown;
};

const emailKey = (request: FastifyRequest): string => {
  const email = (request.body as EmailBody | undefined)?.email;
  return typeof email === "string" && email.trim()
    ? `email:${email.trim().toLowerCase()}`
    : `ip:${request.ip}`;
};

export const RATE_LIMITS = {
  register: {
    max: 5,
    timeWindow: "15 minutes",
    groupId: "auth-register",
    keyGenerator: emailKey,
  },
  login: {
    max: 10,
    timeWindow: "15 minutes",
    groupId: "auth-login",
    keyGenerator: emailKey,
  },
  otpVerify: {
    max: 10,
    timeWindow: "10 minutes",
    groupId: "auth-otp-verify",
    keyGenerator: emailKey,
  },
  otpResend: {
    max: 3,
    timeWindow: "15 minutes",
    groupId: "auth-otp-resend",
    keyGenerator: emailKey,
  },
  passwordReset: {
    max: 5,
    timeWindow: "15 minutes",
    groupId: "auth-password-reset",
  },
  googleVerify: {
    max: 20,
    timeWindow: "15 minutes",
    groupId: "auth-google",
  },
  refreshSession: {
    max: 120,
    timeWindow: "1 hour",
    groupId: "auth-refresh",
  },
  contact: {
    max: 5,
    timeWindow: "1 hour",
    groupId: "contact-email",
  },
  analyticsIngest: {
    max: 60,
    timeWindow: "1 minute",
    groupId: "analytics-ingest",
  },
  upload: {
    max: 30,
    timeWindow: "1 hour",
    groupId: "uploads",
  },
  realtimeConnect: {
    max: 20,
    timeWindow: "5 minutes",
    groupId: "realtime-connect",
  },
  realtimeTicket: {
    max: 30,
    timeWindow: "5 minutes",
    groupId: "realtime-ticket",
  },
} as const;
