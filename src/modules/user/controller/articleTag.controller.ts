import { FastifyReply, FastifyRequest } from "fastify";
import { ArticleTagService } from "../../user/service";

export class ArticleTagController {
  constructor(private readonly service: ArticleTagService) {}

  async assignTag(
    req: FastifyRequest<{ Body: { article_id: number; tag_id: number } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.create(req.body.article_id, req.body.tag_id);
    reply.send(result);
  }

  async bulkAssign(
    req: FastifyRequest<{ Body: { pairs: { article_id: number; tag_id: number }[] } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.bulkCreate(req.body.pairs);
    reply.send(result);
  }

  async findTagsByArticle(
    req: FastifyRequest<{ Params: { articleId: string } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.findTagsByArticle(Number(req.params.articleId));
    reply.send(result);
  }

  async findArticlesByTag(
    req: FastifyRequest<{ Params: { tagId: string } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.findArticlesByTag(Number(req.params.tagId));
    reply.send(result);
  }

  async unassignTag(
    req: FastifyRequest<{ Body: { article_id: number; tag_id: number } }>,
    reply: FastifyReply
  ) {
    const result = await this.service.delete(req.body.article_id, req.body.tag_id);
    reply.send(result);
  }
}
