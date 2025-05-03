import { FastifyInstance } from "fastify";
import { AuthController } from "../controller/auth.controller";
import { AuthService } from "../service/auth.service";

import 'fastify'; // important!
import { Repository } from "typeorm";
import { User, TravelAgencyProfile, CustomerProfile } from "@entity/user";
import { MailService } from "../service/mail.service";
import { AppDataSource } from "../../../config/ormconfig";

declare module 'fastify' {
  interface FastifyInstance {
    userRepository: Repository<User>;
    agencyProfileRepository: Repository<TravelAgencyProfile>;
    customerProfileRepository: Repository<CustomerProfile>;
    mailService: MailService;
  }
}

const userRepository = AppDataSource.getRepository(User);
const agencyProfileRepository = AppDataSource.getRepository(TravelAgencyProfile);
const customerProfileRepository = AppDataSource.getRepository(CustomerProfile);
const mailService = new MailService();

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(
    userRepository,
    agencyProfileRepository,
    customerProfileRepository,
    mailService,
  );
  const authController = new AuthController(authService);
  // Registration
  fastify.post("/auth/register", authController.register.bind(authController));

  // Login
  fastify.post("/auth/login", authController.login.bind(authController));

  // Email Verification (GET for link clicks)
  fastify.get("/auth/verify-email", authController.verifyEmail.bind(authController));
}