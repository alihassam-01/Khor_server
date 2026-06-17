import { FastifyInstance } from "fastify";
import { ArticleTagController } from "@modules/user/controller";
import { ArticleTagService } from "@modules/user/service";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import {
  IArticleIdTagParams,
  IArticleTagPair,
  IBulkAssignTagsBody,
  ITagIdTagParams,
} from "@modules/user/types";

export async function articleTagRoutes(app: FastifyInstance) {
  const controller = new ArticleTagController(new ArticleTagService());
  const adminOnly = [authenticate, authorizeAdmin];

  app.post<{ Body: IArticleTagPair }>("/article-tags", { preHandler: adminOnly }, controller.assignTag.bind(controller));
  app.post<{ Body: IBulkAssignTagsBody }>("/article-tags/bulk", { preHandler: adminOnly }, controller.bulkAssign.bind(controller));
  app.get<{ Params: IArticleIdTagParams }>("/article-tags/article/:articleId", controller.findTagsByArticle.bind(controller));
  app.get<{ Params: ITagIdTagParams }>("/article-tags/tag/:tagId", controller.findArticlesByTag.bind(controller));
  app.delete<{ Body: IArticleTagPair }>("/article-tags", { preHandler: adminOnly }, controller.unassignTag.bind(controller));
}
