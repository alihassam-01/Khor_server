import { FastifyInstance } from "fastify";
import { UserController } from "../controller/user.controller";
import { UserService } from "../service/user.service";
import { authenticate } from "middlewares/authenticate";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService();
  const userController = new UserController(userService);

  fastify.post("/users", userController.createUser.bind(userController));
  fastify.get("/users", userController.getUsers.bind(userController));
  fastify.get("/vendors", userController.getVendors.bind(userController));
  fastify.get("/customers", userController.getCustomers.bind(userController));
  fastify.post<{ Params: { id: string }; Body: any }>(
    "/users/:id",
    { preHandler: authenticate },
    userController.update.bind(userController)
  );
  fastify.get("/users/:id", userController.getUserById.bind(userController));
  fastify.post<{ Body: { currentPassword: string; newPassword: string; confirmPassword: string } }>(
    "/users/password",
    { preHandler: authenticate },
    userController.updatePassword.bind(userController)
  );

  fastify.post<{ Body: { email: string } }>(
    "/users/forgot-password",
    userController.forgotPassword.bind(userController)
  );
}
