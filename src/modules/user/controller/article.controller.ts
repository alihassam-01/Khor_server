import { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from '../service/article.service';
import { Article } from '../entity/article';

export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  async createArticle(req: FastifyRequest<{ Body: Partial<Article> }>, reply: FastifyReply) {
    try {
      const article = await this.articleService.createArticle(req.body);
      reply.code(201).send(article);
    } catch (error: any) {
      reply.code(400).send({ message: error.message || 'Failed to create article' });
    }
  }

  async getArticleById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
        console.log("getArticleById: ",req.params.id)
        const article = await this.articleService.getArticleById(Number(req.params.id));
        console.log("getArticleByIdafter:")

      if (!article) { 
        return reply.code(404).send({ message: 'Article not found' });
      }
      reply.send(article);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async getArticleBySlug(req: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) {
    try {
      const article = await this.articleService.getArticleBySlug(req.params.slug);
      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }
      reply.send(article);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async updateArticle(req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) {
    try {
      const article = await this.articleService.updateArticle(Number(req.params.id), req.body);
      reply.send(article);
    } catch (error: any) {
      reply.code(400).send({ message: error.message });
    }
  }

  async deleteArticle(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      await this.articleService.deleteArticle(Number(req.params.id));
      reply.code(204).send();
    } catch (error: any) {
      reply.code(404).send({ message: error.message });
    }
  }

  async listArticles(req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) {
    try {
      const articles = await this.articleService.listArticles(req.query as { page?: number; limit?: number; status?: string; placeId?: number; categoryId?: number; tag?: string });
      reply.send(articles);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }
}
