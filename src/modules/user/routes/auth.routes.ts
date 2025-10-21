import { FastifyInstance } from "fastify";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "../service/auth.service";

import "fastify"; // important!
import { Repository } from "typeorm";
import { User, CustomerProfile } from "../entity/user";
import { AppDataSource } from "../../../config/ormconfig";
import { Vendor } from "../entity/business";

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
  fastify.post("/auth/register", authController.register.bind(authController));

  // Login
  fastify.post("/auth/login", authController.login.bind(authController));

  // Email Verification (GET for link clicks)
  fastify.get(
    "/auth/verify-email",
    authController.verifyEmail.bind(authController)
  );

  // Resend Verification Email
  fastify.post(
    "/auth/resend-verification-email",
    authController.resendVerificationEmail.bind(authController)
  );

  // Reset Password (from emailed token)
  fastify.post(
    "/auth/reset-password",
    authController.resetPassword.bind(authController)
  );
}
