import { FastifyInstance } from "fastify";
import { ArticleService } from "@modules/user/service/article.service";
import { ArticleController } from "@modules/user/controller/article.controller";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { optionalAuthenticate } from "@middlewares/optionalAuthenticate";
import { ICreateArticleDTO, IUpdateArticleDTO } from "@modules/user/dtos";
import {
  IArticleIdParams,
  IArticleSlugParams,
  IGetArticleQuery,
  IListArticlesQuery,
  ISearchArticlesQuery,
} from "@modules/user/types";

export default async function articleRoutes(fastify: FastifyInstance) {
  const articleService = new ArticleService();
  const articleController = new ArticleController(articleService);

  const adminOnly = [authenticate, authorizeAdmin];

  fastify.post<{ Body: ICreateArticleDTO }>("/articles", { preHandler: adminOnly }, articleController.createArticle.bind(articleController));
  fastify.get<{ Querystring: IGetArticleQuery }>("/articles", { preHandler: optionalAuthenticate }, articleController.getAllArticles.bind(articleController));
  fastify.get<{ Querystring: IListArticlesQuery }>("/articles/list", { preHandler: adminOnly }, articleController.listArticles.bind(articleController));
  fastify.get<{ Params: IArticleSlugParams; Querystring: IGetArticleQuery }>("/articles/slug/:slug", { preHandler: optionalAuthenticate }, articleController.getArticleBySlug.bind(articleController));
  fastify.get<{ Querystring: ISearchArticlesQuery }>("/articles/search", { preHandler: optionalAuthenticate }, articleController.searchArticles.bind(articleController));
  fastify.get<{ Params: IArticleIdParams; Querystring: IGetArticleQuery }>("/articles/:id", { preHandler: optionalAuthenticate }, articleController.getArticleById.bind(articleController));
  fastify.put<{ Params: IArticleIdParams; Body: IUpdateArticleDTO }>("/articles/:id", { preHandler: adminOnly }, articleController.updateArticle.bind(articleController));
  fastify.delete<{ Params: IArticleIdParams }>("/articles/:id", { preHandler: adminOnly }, articleController.deleteArticle.bind(articleController));
}
