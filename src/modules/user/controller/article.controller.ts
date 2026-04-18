import { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from '@modules/user/service/article.service';
import {
  IArticleIdParams,
  IArticleSlugParams,
  IGetArticleQuery,
  IListArticlesQuery,
  ISearchArticlesQuery
} from '@modules/user/types';
import {
  ICreateArticleDTO,
  IUpdateArticleDTO,
  IArticleDTO,
  IPaginatedArticlesResponse
} from '@modules/user/dtos';

export class ArticleController {
  constructor(private readonly articleService: ArticleService) { }

  async createArticle(
    req: FastifyRequest<{ Body: ICreateArticleDTO }>,
    reply: FastifyReply
  ) {
    try {
      const body = req.body;

      const articleData: ICreateArticleDTO = {
        ...body,
        location_ids: (body.location_ids || []).map(Number).filter(n => !isNaN(n)),
        categories: (body.categories || []).map(Number).filter(n => !isNaN(n)),
        tags: Array.isArray(body.tags)
          ? (body.tags as string[]).filter((t: string) => t?.trim())
          : typeof (body as any).tags === 'string'
            ? ((body as any).tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
            : [],
      };

      const article: IArticleDTO = await this.articleService.createArticle(articleData);
      reply.code(201).send(article);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(400).send({ message: err.message || 'Failed to create article' });
    }
  }

  async getArticleById(
    req: FastifyRequest<{ Params: IArticleIdParams; Querystring: IGetArticleQuery }>,
    reply: FastifyReply
  ) {
    try {
      const includeAll = req.query.all === 'true';
      const article = await this.articleService.getArticleById(Number(req.params.id), includeAll);

      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }

      reply.send(article);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }

  async getArticleBySlug(
    req: FastifyRequest<{ Params: IArticleSlugParams; Querystring: IGetArticleQuery }>,
    reply: FastifyReply
  ) {
    try {
      const includeAll = req.query.all === 'true';
      const article = await this.articleService.getArticleBySlug(req.params.slug, includeAll);
      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }

      reply.send(article);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }

  async updateArticle(
    req: FastifyRequest<{ Params: IArticleIdParams; Body: IUpdateArticleDTO }>,
    reply: FastifyReply
  ) {
    try {
      const articleId = Number(req.params.id);
      const body = req.body;

      const articleData: IUpdateArticleDTO = {
        ...body,
        location_ids: body.location_ids
          ? body.location_ids.map(Number).filter(n => !isNaN(n))
          : undefined,
        categories: body.categories
          ? body.categories.map(Number).filter(n => !isNaN(n))
          : undefined,
        tags: Array.isArray(body.tags)
          ? (body.tags as string[]).filter((t: string) => t?.trim())
          : typeof (body as any).tags === 'string'
            ? ((body as any).tags as string).split(',').map((t: string) => t.trim()).filter(Boolean)
            : undefined,
      };

      const article: IArticleDTO = await this.articleService.updateArticle(articleId, articleData);
      reply.send(article);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(400).send({ message: err.message });
    }
  }

  async deleteArticle(
    req: FastifyRequest<{ Params: IArticleIdParams }>,
    reply: FastifyReply
  ) {
    try {
      await this.articleService.deleteArticle(Number(req.params.id));
      reply.code(204).send();
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(404).send({ message: err.message });
    }
  }

  async listArticles(
    req: FastifyRequest<{ Querystring: IListArticlesQuery }>,
    reply: FastifyReply
  ) {
    try {
      const { page, limit, status, placeId, categoryId, tag } = req.query;
      const result: IPaginatedArticlesResponse = await this.articleService.listArticles({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        status,
        placeId: placeId ? Number(placeId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        tag,
      });
      reply.send(result);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }

  async getAllArticles(
    req: FastifyRequest<{ Querystring: IGetArticleQuery }>,
    reply: FastifyReply
  ) {
    try {
      const includeAll = req.query.all === 'true';
      const articles: IArticleDTO[] = await this.articleService.getAllArticles(includeAll);
      reply.send(articles);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }

  async searchArticles(
    req: FastifyRequest<{ Querystring: ISearchArticlesQuery }>,
    reply: FastifyReply
  ) {
    try {
      const includeAll = req.query.all === 'true';
      const articles: IArticleDTO[] = await this.articleService.searchArticles(req.query.term || '', includeAll);
      reply.send(articles);
    } catch (error: unknown) {
      const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }
}