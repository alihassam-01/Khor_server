import { AppDataSource } from "../../../config/ormconfig";
import { Article, Tag, ArticleTag } from "../entity/article";
import { Location } from "../entity/location";
import { IArticleDTO } from "../dtos/article.dto";
import { LocationHelperService } from "./helper/location-helper.service";
import { R2ClientService } from "./r2client.service";
import { logError } from "../../../lib/logger";
// import { LocationCategory } from "../entity/location-category.entity";
// import { In } from 'typeorm';
// import {Media} from '../entity/media.entity';

export class ArticleService {
  private articleRepository = AppDataSource.getRepository(Article);
  private locationRepository = AppDataSource.getRepository(Location);
  private tagRepository = AppDataSource.getRepository(Tag);
  private locationHelper = new LocationHelperService();
  private r2ClientService = new R2ClientService();
  // private categoryRepository = AppDataSource.getRepository(LocationCategory);
  // private mediaRepository = AppDataSource.getRepository(Media);

  private toArticleDTO(article: Article): IArticleDTO {
    return {
      article_id: article.article_id,
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      published_at: article.published_at,
      seo_title: article.seo_title || "",
      seo_keywords: article.seo_keywords || "",
      seo_description: article.seo_description || "",
      // Ensure we always return an array for image_urls. If DB returns null/undefined, return []
      image_urls: Array.isArray(article.image_urls) ? article.image_urls : [],
      location: {
        location_id: article.location?.location_id || 0,
        name: article.location?.name || "",
      },
      tags: article.articleTags?.map((tag) => tag.tag.name) || [],
    };
  }
  async createArticle(articleData: any): Promise<IArticleDTO> {
    if (!articleData || !articleData.title) {
      throw new Error('Article title is required');
    }
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. Find or create tags
      const tagNames = articleData.tags || [];
      const tags: Tag[] = [];

      for (const tagName of tagNames) {
        let tag = await this.tagRepository.findOne({
          where: { name: tagName },
        });
        if (!tag) {
          tag = new Tag();
          tag.name = tagName;
          tag.slug = this.generateSlug(tagName);
          await queryRunner.manager.save(tag);
        }
        tags.push(tag);
      }

      // 2. Find location and categories
      const location = await this.locationRepository.findOne({
        where: { location_id: articleData.location_id },
      });

      if (!location) {
        throw new Error("Place not found");
      }

      // const categories = await this.categoryRepository.find({
      //     where: { categoryId: In(articleData.categories || []) }
      // });

      // 4. Create the article
      const article = new Article();
      article.title = articleData.title;
      article.slug = articleData.slug || this.generateSlug(articleData.title);
      article.excerpt = articleData.excerpt;
      article.content = articleData.content;
      article.published_at = articleData.published_at
        ? new Date(articleData.published_at)
        : null;
      article.seo_title = articleData.seo_title;
      article.seo_keywords = articleData.seo_keywords || "";
      article.seo_description = articleData.seo_description;
      article.location = location;
      // Accept either `image_urls` (array) or singular `image_url` (string) from caller.
      // Default to empty array so Postgres receives a proper text[] parameter.
      if (Array.isArray(articleData.image_urls)) {
        article.image_urls = articleData.image_urls;
      } else if (typeof articleData.image_url === 'string' && articleData.image_url.trim() !== '') {
        article.image_urls = [articleData.image_url];
      } else {
        article.image_urls = [];
      }
      const articleTags: ArticleTag[] = tags.map((tag) => {
        const articleTag = new ArticleTag();
        articleTag.article = article;
        articleTag.tag = tag;
        articleTag.article_id = article.article_id;
        articleTag.tag_id = tag.tagId;
        return articleTag;
      });

      article.articleTags = articleTags;

      const savedArticle = await queryRunner.manager.save(article);
      await queryRunner.commitTransaction();
      article.articleTags.forEach((tag) => {
        delete (tag as any).article;
      });
      return this.toArticleDTO(savedArticle);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getArticleById(articleId: number): Promise<any | null> {
    const article = await this.articleRepository.findOne({
      where: { article_id: articleId },
      relations: [
        "location",
        "articleTags",
        "location.attributes",
        "location.categoryMappings",
      ],
    });
    if (!article) return null;
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      [article]
    );
    return enrichedArticles[0] || null;
  }

  async getArticleBySlug(slug: string): Promise<any | null> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: [
        "location",
        "articleTags",
        "location.attributes",
        "location.categoryMappings",
      ],
    });
    if (!article) return null;
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      [article]
    );
    return enrichedArticles[0] || null;
  }

  async updateArticle(
    articleId: number,
    articleData: any
  ): Promise<IArticleDTO> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const article = await this.articleRepository.findOne({
        where: { article_id: articleId },
        relations: ["articleTags", "articleTags.tag", "location"],
      });

      if (!article) {
        throw new Error("Article not found");
      }

      // Update basic fields
      if (articleData.title) article.title = articleData.title;
      if (articleData.slug) article.slug = articleData.slug;
      if (articleData.excerpt) article.excerpt = articleData.excerpt;
      if (articleData.content) article.content = articleData.content;
      if (articleData.published_at) {
        article.published_at = new Date(articleData.published_at);
      }
      if (articleData.seo_title) article.seo_title = articleData.seo_title;
      if (articleData.seo_description)
        article.seo_description = articleData.seo_description;

      // Update location if changed
      if (
        articleData.location_id &&
        article.location?.location_id !== articleData.location_id
      ) {
        const location = await this.locationRepository.findOne({
          where: { location_id: articleData.location_id },
        });
        if (location) article.location = location;
      }

      // Update tags if provided
      if (articleData.tags) {
        const tagNames = articleData.tags;
        const tags: Tag[] = [];

        for (const tagName of tagNames) {
          let tag = await this.tagRepository.findOne({
            where: { name: tagName },
          });
          if (!tag) {
            tag = new Tag();
            tag.name = tagName;
            tag.slug = this.generateSlug(tagName);
            await queryRunner.manager.save(tag);
          }
          tags.push(tag);
        }

        const articleTags: ArticleTag[] = tags.map((tag) => {
          const articleTag = new ArticleTag();
          articleTag.article = article;
          articleTag.tag = tag;
          articleTag.article_id = article.article_id;
          articleTag.tag_id = tag.tagId;
          return articleTag;
        });

        article.articleTags = articleTags;
      }

      // Support updating image(s) in update flow if provided
      if (articleData.image_urls || articleData.image_url) {
        const oldImages = article.image_urls || [];
        let newImages: string[] = [];

        if (Array.isArray(articleData.image_urls)) {
          newImages = articleData.image_urls;
        } else if (typeof articleData.image_url === 'string') {
          newImages = [articleData.image_url];
        }

        const imagesToDelete = oldImages.filter(img => !newImages.includes(img));
        article.image_urls = newImages;

        if (imagesToDelete.length > 0) {
          this.r2ClientService.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Article image cleanup on update'));
        }
      }

      const updatedArticle = await queryRunner.manager.save(article);
      await queryRunner.commitTransaction();
      article.articleTags.forEach((tag) => {
        delete (tag as any).article;
      });
      return this.toArticleDTO(updatedArticle);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteArticle(articleId: number): Promise<void> {
    const article = await this.articleRepository.findOne({
      where: { article_id: articleId },
    });

    if (!article) {
      throw new Error("Article not found");
    }

    const imagesToDelete = article.image_urls || [];
    
    await this.articleRepository.remove(article);

    if (imagesToDelete.length > 0) {
      this.r2ClientService.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Article image cleanup on delete'));
    }
  }

  async listArticles(options: {
    page?: number;
    limit?: number;
    status?: string;
    placeId?: number;
    categoryId?: number;
    tag?: string;
  }): Promise<{ articles: any[]; count: number }> {
    const { page = 1, limit = 10, status, placeId, tag } = options;
    const skip = (page - 1) * limit;

    const query = this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.location", "location")
      .leftJoinAndSelect("article.articleTags", "articleTags")
      .skip(skip)
      .take(limit)
      .orderBy("article.published_at", "DESC");

    if (status) {
      query.andWhere("article.status = :status", { status });
    }

    if (placeId) {
      query.andWhere("article.location_id = :placeId", { placeId });
    }

    // If you want to filter by tag slug, make sure `articleTags` has a `tag` relation or a `slug`
    if (tag) {
      query.innerJoin(
        "article.articleTags",
        "filterTag",
        "filterTag.slug = :tag",
        { tag }
      );
    }

    const [articles, count] = await query.getManyAndCount();

    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );

    return { articles: enrichedArticles, count };
  }

  // get all articles
  async getAllArticles(): Promise<any[]> {
    const articles = await this.articleRepository.find({
      relations: [
        "articleTags",
        "location",
        "location.categoryMappings",
        "location.attributes",
      ],
      order: { published_at: "DESC" },
    });
    // Enrich articles with location data
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );
    return enrichedArticles;
  }

  /**
   * Search articles using PostgreSQL full-text search and rank by relevance.
   */
  async searchArticles(term: string): Promise<any[]> {
    const normalizedTerm = (term || "").trim();
    if (!normalizedTerm) {
      return [];
    }

    const articles = await this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.articleTags", "articleTags")
      .leftJoinAndSelect("article.location", "location")
      .leftJoinAndSelect("location.categoryMappings", "locationCategoryMappings")
      .leftJoinAndSelect("location.attributes", "locationAttributes")
      .addSelect(
        `ts_rank_cd(article.search_vector, websearch_to_tsquery('english', :term))`,
        "rank"
      )
      .where(
        `article.search_vector @@ websearch_to_tsquery('english', :term)`,
        { term: normalizedTerm }
      )
      .orderBy("rank", "DESC")
      .addOrderBy("article.published_at", "DESC")
      .getMany();

    // Enrich articles with location data
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );
    return enrichedArticles;
  }

  private generateSlug(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove non-word chars
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/--+/g, "-") // Replace multiple - with single -
      .trim();
  }
}
