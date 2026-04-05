import { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from '@modules/user/service/article.service';
import { R2ClientService } from '@modules/user/service/r2client.service';
import { extractMultipartFields, isMultipartRequest } from '@common/utils/multipart.util';

export class ArticleController {
  private r2ClientService: R2ClientService;

  constructor(private readonly articleService: ArticleService) {
    this.r2ClientService = new R2ClientService();
  }

  async createArticle(req: FastifyRequest, reply: FastifyReply) {
    try {
      const contentType = req.headers['content-type'] || '';
      let articleData: any = {};

      if (isMultipartRequest(contentType as string)) {
        const body: any = req.body as any;
        const imageUrls: string[] = [];

        // Extract plain field values from multipart body
        const fields = extractMultipartFields<any>(body, {
          location_id: 'number',
          tags: 'array',
        });

        // Handle image uploads from multipart body (supports single or multiple files)
        const imagesRaw = body?.images;
        if (imagesRaw) {
          const images = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
          for (const image of images) {
            if (imageUrls.length >= 3) break;
            if (image && typeof image !== 'string' && typeof image.toBuffer === 'function') {
              const buffer: Buffer = await image.toBuffer();
              const result = await this.r2ClientService.uploadFileToR2(
                buffer,
                image.filename || 'image',
                image.mimetype || 'application/octet-stream'
              );
              imageUrls.push(result.url);
            }
          }
        }

        articleData = {
          ...fields,
          image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        };
      } else {
        articleData = req.body as any;
        if (articleData?.tags && typeof articleData.tags === 'string') {
          try {
            articleData.tags = JSON.parse(articleData.tags);
          } catch {
            articleData.tags = articleData.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }
        if (articleData?.location_id) {
          articleData.location_id = Number(articleData.location_id);
        }
      }

      const article = await this.articleService.createArticle(articleData);
      reply.code(201).send(article);
    } catch (error: any) {
      console.error('Error creating article:', error);
      reply.code(400).send({ message: error.message || 'Failed to create article' });
    }
  }

  async getArticleById(req: FastifyRequest<{ Params: { id: string }, Querystring: { all?: string } }>, reply: FastifyReply) {
    try {
      const includeAll = req.query.all === 'true';
      const article = await this.articleService.getArticleById(Number(req.params.id), includeAll);

      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }

      // Reviews removed for Phase 1
      reply.send(article);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async getArticleBySlug(req: FastifyRequest<{ Params: { slug: string }, Querystring: { all?: string } }>, reply: FastifyReply) {
    try {
      const includeAll = req.query.all === 'true';
      const article = await this.articleService.getArticleBySlug(req.params.slug, includeAll);
      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }

      // Reviews removed for Phase 1
      reply.send(article);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async updateArticle(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const articleId = Number(req.params.id);

      const contentType = req.headers['content-type'] || '';
      let articleData: any = {};

      if (isMultipartRequest(contentType as string)) {
        const body: any = req.body as any;
        const imageUrls: string[] = [];

        articleData = extractMultipartFields<any>(body, {
          location_id: 'number',
          tags: 'array',
        });

        const imagesRaw = body?.images;
        if (imagesRaw) {
          const images = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
          for (const image of images) {
            if (imageUrls.length >= 3) break;
            if (image && typeof image !== 'string' && typeof image.toBuffer === 'function') {
              const buffer: Buffer = await image.toBuffer();
              const result = await this.r2ClientService.uploadFileToR2(
                buffer,
                image.filename || 'image',
                image.mimetype || 'application/octet-stream'
              );
              imageUrls.push(result.url);
            }
          }
        }

        if (imageUrls.length > 0) articleData.image_urls = imageUrls;
      } else {
        // Handle regular JSON body
        articleData = req.body;
        if (articleData?.tags && typeof articleData.tags === 'string') {
          try {
            articleData.tags = JSON.parse(articleData.tags);
          } catch {
            articleData.tags = articleData.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }
        if (articleData?.location_id) {
          articleData.location_id = Number(articleData.location_id);
        }
      }

      const article = await this.articleService.updateArticle(articleId, articleData);
      reply.send(article);
    } catch (error: any) {
      console.error('Error updating article:', error);
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

  async getAllArticles(req: FastifyRequest<{ Querystring: { all?: string } }>, reply: FastifyReply) {
    try {
      const includeAll = req.query.all === 'true';
      const articles = await this.articleService.getAllArticles(includeAll);

      // Reviews removed for Phase 1
      reply.send(articles);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async searchArticles(req: FastifyRequest<{ Querystring: { term: string, all?: string } }>, reply: FastifyReply) {
    try {
      const includeAll = req.query.all === 'true';
      const results = await this.articleService.searchArticles(req.query.term, includeAll);
      reply.send(results);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }
}