import { FastifyInstance } from "fastify";
import { ArticleTagController } from "@modules/user/controller";
import { ArticleTagService } from "@modules/user/service";

export async function articleTagRoutes(app: FastifyInstance) {
  const controller = new ArticleTagController(new ArticleTagService());

  app.post("/article-tags", controller.assignTag.bind(controller));
  app.post("/article-tags/bulk", controller.bulkAssign.bind(controller));
  app.get("/article-tags/article/:articleId", controller.findTagsByArticle.bind(controller));
  app.get("/article-tags/tag/:tagId", controller.findArticlesByTag.bind(controller));
  app.delete("/article-tags", controller.unassignTag.bind(controller));
}
