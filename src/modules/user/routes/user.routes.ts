import { FastifyInstance } from "fastify";
import { UserController } from "../controller/user.controller";
import { UserService } from "../service/user.service";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService();
  const userController = new UserController(userService);

  fastify.post("/users", userController.createUser.bind(userController));
  fastify.get("/users", userController.getUsers.bind(userController));
  fastify.get("/vendors", userController.getVendors.bind(userController));
  fastify.get("/customers", userController.getCustomers.bind(userController));
  fastify.get("/users/:id", userController.getUserById.bind(userController));
}