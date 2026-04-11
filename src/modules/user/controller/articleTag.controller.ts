import { FastifyReply, FastifyRequest } from "fastify";
import { ArticleTagService } from "@modules/user/service/articleTag.service";
import { 
    IArticleTagPair, 
    IBulkAssignTagsBody, 
    IArticleIdTagParams, 
    ITagIdTagParams 
} from "@modules/user/types";

export class ArticleTagController {
  constructor(private readonly service: ArticleTagService) {}

  async assignTag(
    req: FastifyRequest<{ Body: IArticleTagPair }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.service.create(req.body.article_id, req.body.tag_id);
        reply.send(result);
    } catch (error: unknown) {
        const err = error as Error;
        reply.code(400).send({ message: err.message || "Error assigning tag" });
    }
  }

  async bulkAssign(
    req: FastifyRequest<{ Body: IBulkAssignTagsBody }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.service.bulkCreate(req.body.pairs);
        reply.send(result);
    } catch (error: unknown) {
        const err = error as Error;
        reply.code(400).send({ message: err.message || "Error bulk assigning tags" });
    }
  }

  async findTagsByArticle(
    req: FastifyRequest<{ Params: IArticleIdTagParams }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.service.findTagsByArticle(Number(req.params.articleId));
        reply.send(result);
    } catch (error: unknown) {
        const err = error as Error;
        reply.code(500).send({ message: err.message || "Error fetching tags for article" });
    }
  }

  async findArticlesByTag(
    req: FastifyRequest<{ Params: ITagIdTagParams }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.service.findArticlesByTag(Number(req.params.tagId));
        reply.send(result);
    } catch (error: unknown) {
        const err = error as Error;
        reply.code(500).send({ message: err.message || "Error fetching articles for tag" });
    }
  }

  async unassignTag(
    req: FastifyRequest<{ Body: IArticleTagPair }>,
    reply: FastifyReply
  ) {
    try {
        const result = await this.service.delete(req.body.article_id, req.body.tag_id);
        reply.send(result);
    } catch (error: unknown) {
        const err = error as Error;
        reply.code(400).send({ message: err.message || "Error unassigning tag" });
    }
  }
}
