import { FastifyInstance } from "fastify";
import { UserController } from "../controller/user.controller";
import { UserService } from "../service/user.service";

export default async function userRoutes(fastify: FastifyInstance) {
  const userService = new UserService();
  const userController = new UserController(userService);

  fastify.post("/users", userController.createUser.bind(userController));
  // fastify.get("/users", userController.getUsers.bind(userController));
}