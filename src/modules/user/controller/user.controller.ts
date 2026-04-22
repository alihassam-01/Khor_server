import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "@modules/user/service/user.service";
import { UserRole } from "@common/enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { 
  IChangeRoleBody, 
  IUpdateUserBody, 
  IForgotPasswordBody, 
  IUserIdParams 
} from "@modules/user/types";
import { IPassData } from "@modules/user/dtos";

export class UserController {
  constructor(private userService: UserService) {}

  async forgotPassword(
    req: FastifyRequest<{ Body: IForgotPasswordBody }>,
    reply: FastifyReply
  ) {
    const { email } = req.body;
    if (!email) {
      throw new AppError("Email is required", 400, ErrorCodes.BAD_REQUEST);
    }
    await this.userService.forgotPassword(email);
    reply.send({ success: true, message: "If the email exists, a reset link has been sent." });
  }

  async getUsers(_req: FastifyRequest, reply: FastifyReply) {
    const users = await this.userService.getUsers();
    reply.send(users);
  }

  async getUserById(
    req: FastifyRequest<{ Params: IUserIdParams }>,
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

  async deleteUser(
    req: FastifyRequest<{ Params: IUserIdParams }>,
    reply: FastifyReply
  ) {
    const result = await this.userService.deleteUser(req.params.id);
    reply.send(result);
  }

  async changeRole(
    req: FastifyRequest<{ Params: IUserIdParams; Body: IChangeRoleBody }>,
    reply: FastifyReply
  ) {
    const newRole = req.body.role;
    if (!Object.values(UserRole).includes(newRole as UserRole)) {
      throw new AppError("Invalid role provided.", 400, ErrorCodes.BAD_REQUEST);
    }

    const updatedUser = await this.userService.changeRole(req.params.id, newRole as UserRole);
    reply.send(updatedUser);
  }

  async update(
    req: FastifyRequest<{ Params: IUserIdParams; Body: IUpdateUserBody }>,
    reply: FastifyReply
  ) {
    const userId = req.params.id;
    const userData = req.body.updates;

    // Validate phoneNumber format if provided
    const phoneRegex = /^\+?[0-9\s-]+$/;
    if (userData.phoneNumber && !phoneRegex.test(userData.phoneNumber)) {
        throw new AppError('Phone number must contain only digits, spaces, hyphens and optional leading +', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const updatedUser = await this.userService.updateUser(userId, userData);
    reply.send(updatedUser);
  }

  async updatePassword(
    req: FastifyRequest<{ Body: Omit<IPassData, 'userId'> }>,
    reply: FastifyReply
  ) {
    // Get userId from authenticated user instead of request body
    const userId = (req.user as any)?.id || (req.user as any)?.userId;
    
    if (!userId) {
      throw new AppError("User not authenticated", 401, ErrorCodes.UNAUTHORIZED);
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Create PassData object with userId from token
    const passData: IPassData = {
      userId,
      currentPassword,
      newPassword,
      confirmPassword
    };

    const response = await this.userService.updatePassword(passData);
    reply.send(response);
  }
}
