import { FastifyInstance } from "fastify";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "../service/auth.service";

import "fastify"; // important!
import { Repository } from "typeorm";
import { User, CustomerProfile, Vendor } from "../entity";
import { AppDataSource } from "../../../config/ormconfig";
import { loginSchema, registerSchema, resendVerificationEmailSchema, resetPasswordSchema, verifyEmailSchema } from "../schemas/auth.schema";


declare module "fastify" {
  interface FastifyInstance {
    userRepository: Repository<User>;
    vendor: Repository<Vendor>;
    customerProfileRepository: Repository<CustomerProfile>;
  }
}

const userRepository = AppDataSource.getRepository(User);
const vendor = AppDataSource.getRepository(Vendor);
const customerProfileRepository = AppDataSource.getRepository(CustomerProfile);

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(
    userRepository,
    vendor,
    customerProfileRepository
  );
  const authController = new AuthController(authService);
  // Registration
  fastify.post("/auth/register", { schema: registerSchema }, authController.register.bind(authController));

  // Login
  fastify.post("/auth/login", { schema: loginSchema }, authController.login.bind(authController));

  // Email Verification (GET for link clicks)
  fastify.get(
    "/auth/verify-email",
    { schema: verifyEmailSchema },
    authController.verifyEmail.bind(authController)
  );

  // Resend Verification Email
  fastify.post(
    "/auth/resend-verification-email",
    { schema: resendVerificationEmailSchema },
    authController.resendVerificationEmail.bind(authController)
  );

  // Reset Password (from emailed token)
  fastify.post(
    "/auth/reset-password",
    { schema: resetPasswordSchema },
    authController.resetPassword.bind(authController)
  );
}
