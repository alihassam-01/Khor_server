import { FastifyInstance } from "fastify";
import { UserController } from "@modules/user/controller/user.controller";
import { UserService } from "@modules/user/service/user.service";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { authorizeSelfOrAdmin } from "@middlewares/authorizeSelfOrAdmin";
import { RATE_LIMITS } from "@config/rate-limit.config";
import { 
    IUserIdParams, 
    IChangeRoleBody, 
    IUpdateUserBody, 
    IForgotPasswordBody 
} from "@modules/user/types";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService();
  const userController = new UserController(userService);

  fastify.get(
    "/users",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.getUsers.bind(userController)
  );
  fastify.get(
    "/vendors",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.getVendors.bind(userController)
  );
  fastify.get(
    "/customers",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.getCustomers.bind(userController)
  );

  fastify.get(
    "/admin/hotel-owners",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.getHotelOwners.bind(userController)
  );

  fastify.patch<{ Params: IUserIdParams }>(
    "/admin/hotel-owners/:id/approve",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.approveHotelOwner.bind(userController)
  );

  fastify.patch<{ Params: IUserIdParams }>(
    "/admin/hotel-owners/:id/suspend",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.suspendHotelOwner.bind(userController)
  );
  
  fastify.post<{ Params: IUserIdParams; Body: IUpdateUserBody }>(
    "/users/:id",
    { preHandler: [authenticate, authorizeSelfOrAdmin] },
    userController.update.bind(userController)
  );
  
  // Admin User Management Routes
  fastify.delete<{ Params: IUserIdParams }>(
    "/admin/users/:id",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.deleteUser.bind(userController)
  );

  fastify.patch<{ Params: IUserIdParams; Body: IChangeRoleBody }>(
    "/admin/users/:id/role",
    { preHandler: [authenticate, authorizeAdmin] },
    userController.changeRole.bind(userController)
  );

  fastify.get<{ Params: IUserIdParams }>(
    "/users/:id",
    { preHandler: [authenticate, authorizeSelfOrAdmin] },
    userController.getUserById.bind(userController)
  );
  
  fastify.post<{ Body: any }>( // Password data is complex enough to keep as is or define if needed
    "/users/password",
    { preHandler: authenticate },
    userController.updatePassword.bind(userController)
  );

  fastify.post<{ Body: IForgotPasswordBody }>(
    "/users/forgot-password",
    { config: { rateLimit: RATE_LIMITS.otpResend } },
    userController.forgotPassword.bind(userController)
  );
}
