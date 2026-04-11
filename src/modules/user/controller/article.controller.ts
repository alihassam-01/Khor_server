import { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from '@modules/user/service/article.service';
import { R2ClientService } from '@modules/user/service/r2client.service';
import { extractMultipartFields, isMultipartRequest } from '@common/utils/multipart.util';
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
  private r2ClientService: R2ClientService;

  constructor(private readonly articleService: ArticleService) {
    this.r2ClientService = new R2ClientService();
  }

  async createArticle(
    req: FastifyRequest<{ Body: ICreateArticleDTO | any }>, 
    reply: FastifyReply
  ) {
    try {
      const contentType = (req.headers['content-type'] || '') as string;
      let articleData: ICreateArticleDTO;

      if (isMultipartRequest(contentType)) {
        const body = req.body as Record<string, any>;
        const imageUrls: string[] = [];

        // Extract plain field values from multipart body
        const fields = extractMultipartFields<ICreateArticleDTO>(body, {
          location_id: 'number',
          tags: 'array',
        });

        // Handle image uploads from multipart body
        const imagesRaw = body?.images;
        if (imagesRaw) {
          const images = Array.isArray(imagesRaw) ? imagesRaw : [imagesRaw];
          for (const image of images) {
            if (imageUrls.length >= 3) break;
            if (image && typeof image !== 'string' && typeof image.toBuffer === 'function') {
              const buffer: Buffer = await image.toBuffer();
              const result = await this.r2ClientService.uploadFileToR2(
                buffer,
                image.filename || 'article_image',
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
        const body = req.body as ICreateArticleDTO;
        let tags: string[] | undefined = body.tags;
        
        if (typeof body.tags === 'string') {
          const tagsStr = body.tags as string;
          try {
            tags = JSON.parse(tagsStr);
          } catch {
            tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }
        
        articleData = {
          ...body,
          tags,
          location_id: body.location_id ? Number(body.location_id) : 0
        };
      }

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
    req: FastifyRequest<{ Params: IArticleIdParams; Body: IUpdateArticleDTO | any }>, 
    reply: FastifyReply
  ) {
    try {
      const articleId = Number(req.params.id);
      const contentType = (req.headers['content-type'] || '') as string;
      let articleData: IUpdateArticleDTO;

      if (isMultipartRequest(contentType)) {
        const body = req.body as Record<string, any>;
        const imageUrls: string[] = [];

        articleData = extractMultipartFields<IUpdateArticleDTO>(body, {
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
                image.filename || 'article_image',
                image.mimetype || 'application/octet-stream'
              );
              imageUrls.push(result.url);
            }
          }
        }

        if (imageUrls.length > 0) articleData.image_urls = imageUrls;
      } else {
        const body = req.body as IUpdateArticleDTO;
        let tags: string[] | undefined = body.tags;
        
        if (typeof body.tags === 'string') {
          const tagsStr = body.tags as string;
          try {
            tags = JSON.parse(tagsStr);
          } catch {
            tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
          }
        }

        articleData = {
            ...body,
            tags,
            location_id: body.location_id ? Number(body.location_id) : undefined
        };
      }

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
        const { page = "1", limit = "10", status, placeId, tag } = req.query;
        const result: IPaginatedArticlesResponse = await this.articleService.listArticles({
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10,
            status,
            placeId: placeId ? parseInt(placeId, 10) : undefined,
            tag
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
      const results: IArticleDTO[] = await this.articleService.searchArticles(req.query.term, includeAll);
      reply.send(results);
    } catch (error: unknown) {
        const err = error as Error;
      reply.code(500).send({ message: err.message });
    }
  }
}