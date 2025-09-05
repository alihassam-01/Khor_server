import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "../service/user.service";

export class UserController {
  constructor(private userService: UserService) {}

  async createUser(
    req: FastifyRequest<{ Body: { name: string; email: string } }>,
    reply: FastifyReply
  ) {
    const user = await this.userService.createUser(req.body);
    reply.code(201).send(user);
  }

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
    req: FastifyRequest<{ Params: { id: string }; Body: {updates: any} }>,
    reply: FastifyReply
  ) {
    const userId = req.params.id;
    const userData = req.body.updates;
    const updatedUser = await this.userService.updateUser(userId, userData);
    reply.send(updatedUser);
  }
}
