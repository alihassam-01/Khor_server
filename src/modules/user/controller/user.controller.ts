import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "@modules/user/service/user.service";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../../../constant/error";
import { logError } from "@lib/logger";

export class UserController {
  async forgotPassword(
    req: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply
  ) {
    const { email } = req.body;
    if (!email) {
      return reply.status(400).send({ success: false, message: "Email is required" });
    }
    try {
  await this.userService.forgotPassword(email);
      reply.send({ success: true, message: "If the email exists, a reset link has been sent." });
    } catch (error: any) {
      logError(error, 'Forgot password');
      reply.status(500).send({ success: false, message: error.message || "Failed to process forgot password" });
    }
  }
  constructor(private userService: UserService) {}

  async getUsers(_req: FastifyRequest, reply: FastifyReply) {
    const users = await this.userService.getUsers();
    reply.send(users);
  }

  async getUserById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    const user = await this.userService.getUserById(req.params.id);
    reply.send(user);
  }
  async getCustomers(_req: FastifyRequest, reply: FastifyReply) {
    const customers = await this.userService.getCustomers();
    reply.send(customers);
  }

  async getVendors(_req: FastifyRequest, reply: FastifyReply) {
    const vendors = await this.userService.getVendors();
    reply.send(vendors);
  }

  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: { updates: any } }>,
    reply: FastifyReply
  ) {
    const userId = req.params.id;
    const userData = req.body.updates;
    const updatedUser = await this.userService.updateUser(userId, userData);
    reply.send(updatedUser);
  }

  async updatePassword(
    req: FastifyRequest<{ Body: { currentPassword: string; newPassword: string; confirmPassword: string } }>,
    reply: FastifyReply
  ) {
    try {
      // Get userId from authenticated user instead of request body
      const userId = req.user?.id || req.user?.userId;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          message: "User not authenticated"
        });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Create PassData object with userId from token
      const passData = {
        userId,
        currentPassword,
        newPassword,
        confirmPassword
      };

      const response = await this.userService.updatePassword(passData);
      reply.send(response);
    } catch (error: any) {
      logError(error, 'Update password');
      let statusCode = 500;

      if (error instanceof ValidationError) {
        statusCode = 400; // Bad Request
      } else if (error instanceof NotFoundError) {
        statusCode = 404; // Not Found
      } else if (error instanceof UnauthorizedError) {
        statusCode = 401; // Unauthorized
      }

      reply.status(statusCode).send({
        success: false,
        message: error.message || "Failed to update password",
        error: error.name || "UnknownError",
      });
    }
  }
}
