import { FastifyInstance } from "fastify";
import { ArticleService } from "../service/article.service";
import { ArticleController } from "../controller/article.controller";

import { ReviewService } from "../service/reviews.service";

export default async function articleRoutes(fastify: FastifyInstance) {
  const articleService = new ArticleService();
  const reviewService = new ReviewService();
  const articleController = new ArticleController(articleService, reviewService);

  fastify.post("/articles", articleController.createArticle.bind(articleController));
  fastify.get("/articles", articleController.getAllArticles.bind(articleController));
  fastify.get("/articles/list", articleController.listArticles.bind(articleController));
  fastify.get("/articles/slug/:slug", articleController.getArticleBySlug.bind(articleController));
  fastify.get("/articles/:id", articleController.getArticleById.bind(articleController));
  fastify.put("/articles/:id", articleController.updateArticle.bind(articleController));
  fastify.delete("/articles/:id", articleController.deleteArticle.bind(articleController));
  fastify.get("/articles/search", articleController.searchArticles.bind(articleController));
}
