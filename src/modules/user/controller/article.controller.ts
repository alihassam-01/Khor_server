import { FastifyRequest, FastifyReply } from 'fastify';
import { ArticleService } from '../service/article.service';

import { R2ClientService } from '../service/r2client.service';


import { ReviewService } from '../service/reviews.service';

export class ArticleController {
  private r2ClientService: R2ClientService;

  constructor(
    private readonly articleService: ArticleService,
    private readonly reviewService: ReviewService
  ) {
    this.r2ClientService = new R2ClientService();
  }

  async createArticle(req: FastifyRequest, reply: FastifyReply) {
    try {
      // Parse form fields and handle multiple image files (up to 3)
      const fields: any = {};
      const imageUrls: string[] = [];
      const parts = req.parts();

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'images') {
          if (imageUrls.length >= 3) {
            continue; // Skip if we already have 3 images
          }

          // Convert stream to buffer
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          // Upload to R2
          const result = await this.r2ClientService.uploadFileToR2(
            buffer,
            part.filename,
            part.mimetype
          );
          imageUrls.push(result.url);
        } else if (part.type === 'field') {
          // @ts-ignore
          fields[part.fieldname] = part.value;
        }
      }

      // Parse tags if it's a string
      if (fields.tags && typeof fields.tags === 'string') {
        try {
          fields.tags = JSON.parse(fields.tags);
        } catch {
          fields.tags = fields.tags.split(',').map((t: string) => t.trim());
        }
      }

      // Convert location_id to number
      if (fields.location_id) {
        fields.location_id = Number(fields.location_id);
      }

      // Add uploaded image URLs to article data
      const articleData = {
        ...fields,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      const article = await this.articleService.createArticle(articleData);
      reply.code(201).send(article);
    } catch (error: any) {
      console.error('Error creating article:', error);
      reply.code(400).send({ message: error.message || 'Failed to create article' });
    }
  }

  async getArticleById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      console.log("getArticleById: ", req.params.id)
      const article = await this.articleService.getArticleById(Number(req.params.id));
      console.log("getArticleByIdafter:")

      if (!article) {
        return reply.code(404).send({ message: 'Article not found' });
      }

      const reviewData = await this.reviewService.getReviewsForTarget(
        article.article_id.toString(),
        "article"
      );

      reply.send({ ...article, ...reviewData });
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

      const reviewData = await this.reviewService.getReviewsForTarget(
        article.article_id.toString(),
        "article"
      );

      reply.send({ ...article, ...reviewData });
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async updateArticle(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const articleId = Number(req.params.id);

      // Check if request is multipart (has files)
      const contentType = req.headers['content-type'] || '';
      let articleData: any = {};
      const imageUrls: string[] = [];

      if (contentType.includes('multipart/form-data')) {
        // Handle multipart form data with files
        const parts = req.parts();

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'images') {
            if (imageUrls.length >= 3) {
              continue; // Skip if we already have 3 images
            }

            // Convert stream to buffer
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);

            // Upload to R2
            const result = await this.r2ClientService.uploadFileToR2(
              buffer,
              part.filename,
              part.mimetype
            );
            imageUrls.push(result.url);
          } else if (part.type === 'field') {
            // @ts-ignore
            articleData[part.fieldname] = part.value;
          }
        }

        // Parse tags if it's a string
        if (articleData.tags && typeof articleData.tags === 'string') {
          try {
            articleData.tags = JSON.parse(articleData.tags);
          } catch {
            articleData.tags = articleData.tags.split(',').map((t: string) => t.trim());
          }
        }

        // Convert location_id to number
        if (articleData.location_id) {
          articleData.location_id = Number(articleData.location_id);
        }

        // Add uploaded image URLs if any
        if (imageUrls.length > 0) {
          articleData.image_urls = imageUrls;
        }
      } else {
        // Handle regular JSON body
        articleData = req.body;
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

  async getAllArticles(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const articles = await this.articleService.getAllArticles();

      const articleIds = articles.map(a => a.article_id.toString());
      const reviewsData = await this.reviewService.getReviewsByTargetIds(articleIds);

      const reviewsMap = new Map(reviewsData.map(r => [r.target_id, r]));

      const articlesWithReviews = articles.map(article => {
        const reviewInfo = reviewsMap.get(article.article_id.toString()) || {
          totalReviews: 0,
          avgRating: 0,
          reviews: []
        };
        return { ...article, ...reviewInfo };
      });

      reply.send(articlesWithReviews);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }

  async searchArticles(req: FastifyRequest<{ Querystring: { term: string } }>, reply: FastifyReply) {
    try {
      const results = await this.articleService.searchArticles(req.query.term);
      reply.send(results);
    } catch (error: any) {
      reply.code(500).send({ message: error.message });
    }
  }
}