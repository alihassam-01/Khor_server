import { FastifyReply, FastifyRequest } from "fastify";
import { TagService } from "@modules/user/service";

export class TagController {
  constructor(private readonly tagService: TagService) {}

  async create(
    req: FastifyRequest<{ Body: { name: string; slug: string } }>,
    reply: FastifyReply
  ) {
    try {
      const tag = await this.tagService.create(req.body);
      reply.send(tag);
    } catch (err: any) {
      reply.code(400).send({ message: err.message || "Error creating tag" });
    }
  }

  async findAll(_req: FastifyRequest, reply: FastifyReply) {
    const tags = await this.tagService.findAll();
    reply.send(tags);
  }

  async findById(
    req: FastifyRequest<{ Params: { tagId: string } }>,
    reply: FastifyReply
  ) {
    const tag = await this.tagService.findById(Number(req.params.tagId));
    reply.send(tag);
  }

  async update(
    req: FastifyRequest<{ Params: { tagId: string }; Body: { name?: string; slug?: string } }>,
    reply: FastifyReply
  ) {
    const updated = await this.tagService.update(Number(req.params.tagId), req.body);
    reply.send(updated);
  }

  async delete(
    req: FastifyRequest<{ Params: { tagId: string } }>,
    reply: FastifyReply
  ) {
    const deleted = await this.tagService.delete(Number(req.params.tagId));
    reply.send(deleted);
  }
}
