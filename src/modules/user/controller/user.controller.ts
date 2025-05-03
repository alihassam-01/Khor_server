import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "../service/user.service";

export class UserController {
  constructor(private userService: UserService) {}

  async createUser(req: FastifyRequest<{ Body: { name: string; email: string } }>, reply: FastifyReply) {
    const user = await this.userService.createUser(req.body);
    reply.code(201).send(user);
  }

  async getUsers( reply: FastifyReply) {
    const users = await this.userService.getUsers();
    reply.send(users);
  }
}