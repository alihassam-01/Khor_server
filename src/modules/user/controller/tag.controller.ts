import { FastifyReply, FastifyRequest } from "fastify";
import { TagService } from "@modules/user/service/tag.service";
import { 
    ITagIdParams, 
    ICreateTagBody, 
    IUpdateTagBody 
} from "@modules/user/types";
import { ITagDTO } from "@modules/user/dtos";

export class TagController {
  constructor(private readonly tagService: TagService) {}

  async create(
    req: FastifyRequest<{ Body: ICreateTagBody }>,
    reply: FastifyReply
  ) {
    try {
      const tag: ITagDTO = await this.tagService.create(req.body);
      reply.send(tag);
    } catch (err: unknown) {
        const error = err as Error;
      reply.code(400).send({ message: error.message || "Error creating tag" });
    }
  }

  async findAll(_req: FastifyRequest, reply: FastifyReply) {
    try {
        const tags: ITagDTO[] = await this.tagService.findAll();
        reply.send(tags);
    } catch (err: unknown) {
        const error = err as Error;
        reply.code(500).send({ message: error.message || "Error fetching tags" });
    }
  }

  async findById(
    req: FastifyRequest<{ Params: ITagIdParams }>,
    reply: FastifyReply
  ) {
    try {
        const tag = await this.tagService.findById(Number(req.params.tagId));
        if (!tag) {
            return reply.code(404).send({ message: "Tag not found" });
        }
        reply.send(tag);
    } catch (err: unknown) {
        const error = err as Error;
        reply.code(500).send({ message: error.message || "Error fetching tag" });
    }
  }

  async update(
    req: FastifyRequest<{ Params: ITagIdParams; Body: IUpdateTagBody }>,
    reply: FastifyReply
  ) {
    try {
        const updated = await this.tagService.update(Number(req.params.tagId), req.body);
        if (!updated) {
            return reply.code(404).send({ message: "Tag not found" });
        }
        reply.send(updated);
    } catch (err: unknown) {
        const error = err as Error;
        reply.code(400).send({ message: error.message || "Error updating tag" });
    }
  }

  async delete(
    req: FastifyRequest<{ Params: ITagIdParams }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.tagService.delete(Number(req.params.tagId));
        reply.send(result);
    } catch (err: unknown) {
        const error = err as Error;
        reply.code(400).send({ message: error.message || "Error deleting tag" });
    }
  }
}
