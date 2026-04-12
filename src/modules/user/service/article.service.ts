import { AppDataSource } from "@config/ormconfig";
import { Not, IsNull, FindOptionsWhere } from "typeorm";
import { Article, Tag, ArticleTag } from "@modules/user/entity/article";
import { Location } from "@modules/user/entity/location";
import { ArticleStatus } from "@common/enums";
import { PAGINATION_DEFAULTS } from "@common/constants";
import { 
    IArticleDTO, 
    ICreateArticleDTO, 
    IUpdateArticleDTO, 
    IPaginatedArticlesResponse 
} from "@modules/user/dtos";
import { LocationHelperService, IEnrichedLocation } from "./helper/location-helper.service";
import { R2ClientService } from "./r2client.service";
import { logError } from "@lib/logger";

export class ArticleService {
  private articleRepository = AppDataSource.getRepository(Article);
  private locationRepository = AppDataSource.getRepository(Location);
  private locationHelper = new LocationHelperService();
  private r2ClientService = new R2ClientService();

  private toArticleDTO(article: Article, enriched?: IEnrichedLocation): IArticleDTO {
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
      image_urls: Array.isArray(article.image_urls) ? article.image_urls : [],
      location: {
        location_id: article.location?.location_id || 0,
        name: article.location?.name || "",
        categories: article.location?.categoryMappings?.map(m => ({
          categoryId: m.category.categoryId,
          name: m.category.name,
          slug: m.category.slug
        })) || []
      },
      city: enriched?.city ? {
          location_id: enriched.city.location_id,
          name: enriched.city.name,
          slug: enriched.city.slug
      } : undefined,
      locality: enriched?.locality ? {
          location_id: enriched.locality.location_id,
          name: enriched.locality.name,
          slug: enriched.locality.slug
      } : undefined,
      tags: article.articleTags?.map((at) => at.tag.name) || [],
    };
  }

  async createArticle(articleData: ICreateArticleDTO): Promise<IArticleDTO> {
    if (!articleData || !articleData.title) {
      throw new Error('Article title is required');
    }
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tagNames = articleData.tags || [];
      const tags: Tag[] = [];

      for (const tagName of tagNames) {
        const slug = this.generateSlug(tagName);
        let tag = await queryRunner.manager.findOne(Tag, {
          where: { slug },
        });
        if (!tag) {
          tag = new Tag();
          tag.name = tagName;
          tag.slug = slug;
          tag = await queryRunner.manager.save(tag);
        }
        tags.push(tag);
      }

      const location = await this.locationRepository.findOne({
        where: { location_id: articleData.location_id },
      });

      if (!location) {
        throw new Error("Place not found");
      }

      const article = new Article();
      article.title = articleData.title;
      article.slug = articleData.slug || this.generateSlug(articleData.title);
      article.excerpt = articleData.excerpt || "";
      article.content = articleData.content;
      article.published_at = articleData.published_at
        ? new Date(articleData.published_at)
        : null;
      article.seo_title = articleData.seo_title || "";
      article.seo_keywords = articleData.seo_keywords || "";
      article.seo_description = articleData.seo_description || "";
      article.location = location;
      
      if (Array.isArray(articleData.image_urls)) {
        article.image_urls = articleData.image_urls;
      } else if (typeof articleData.image_url === 'string' && articleData.image_url.trim() !== '') {
        article.image_urls = [articleData.image_url];
      } else {
        article.image_urls = [];
      }

      const savedArticle = await queryRunner.manager.save(article);

      const articleTags: ArticleTag[] = tags.map((tag) => {
        const articleTag = new ArticleTag();
        articleTag.article = savedArticle;
        articleTag.tag = tag;
        articleTag.article_id = savedArticle.article_id;
        articleTag.tag_id = tag.tagId;
        return articleTag;
      });

      await queryRunner.manager.save(ArticleTag, articleTags);
      savedArticle.articleTags = articleTags;

      await queryRunner.commitTransaction();
      
      const resultArticle = await this.articleRepository.findOne({
        where: { article_id: savedArticle.article_id },
        relations: ["location", "articleTags", "articleTags.tag"]
      });

      return this.toArticleDTO(resultArticle!);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getArticleById(articleId: number, includeAll: boolean = false): Promise<IArticleDTO | null> {
    const whereClause: FindOptionsWhere<Article> = { article_id: articleId };
    if (!includeAll) whereClause.published_at = Not(IsNull());
    
    const article = await this.articleRepository.findOne({
      where: whereClause,
      relations: [
        "location",
        "articleTags",
        "articleTags.tag",
        "location.attributes",
        "location.categoryMappings",
      ],
    });
    if (!article) return null;
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      [article]
    );
    const enriched = enrichedArticles[0];
    return this.toArticleDTO(article, enriched);
  }

  async getArticleBySlug(slug: string, includeAll: boolean = false): Promise<IArticleDTO | null> {
    const whereClause: FindOptionsWhere<Article> = { slug };
    if (!includeAll) whereClause.published_at = Not(IsNull());

    const article = await this.articleRepository.findOne({
      where: whereClause,
      relations: [
        "location",
        "articleTags",
        "articleTags.tag",
        "location.attributes",
        "location.categoryMappings",
      ],
    });
    if (!article) return null;
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      [article]
    );
    const enriched = enrichedArticles[0];
    return this.toArticleDTO(article, enriched);
  }

  async updateArticle(
    articleId: number,
    articleData: IUpdateArticleDTO
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

      if (articleData.title) article.title = articleData.title;
      if (articleData.slug) article.slug = articleData.slug;
      if (articleData.excerpt !== undefined) article.excerpt = articleData.excerpt || "";
      if (articleData.content) article.content = articleData.content;
      if (articleData.published_at !== undefined) {
        article.published_at = articleData.published_at ? new Date(articleData.published_at) : null;
      }
      if (articleData.seo_title !== undefined) article.seo_title = articleData.seo_title || "";
      if (articleData.seo_description !== undefined)
        article.seo_description = articleData.seo_description || "";

      if (
        articleData.location_id &&
        article.location?.location_id !== articleData.location_id
      ) {
        const location = await this.locationRepository.findOne({
          where: { location_id: articleData.location_id },
        });
        if (location) article.location = location;
      }

      if (articleData.tags) {
        const tagNames = articleData.tags;
        const tags: Tag[] = [];

        for (const tag_name of tagNames) {
          const slug = this.generateSlug(tag_name);
          let tag = await queryRunner.manager.findOne(Tag, {
            where: { slug },
          });
          if (!tag) {
            tag = new Tag();
            tag.name = tag_name;
            tag.slug = slug;
            tag = await queryRunner.manager.save(tag);
          }
          tags.push(tag);
        }

        await queryRunner.manager.delete(ArticleTag, { article_id: articleId });

        const articleTags: ArticleTag[] = tags.map((tag) => {
          const articleTag = new ArticleTag();
          articleTag.article = article;
          articleTag.tag = tag;
          articleTag.article_id = article.article_id;
          articleTag.tag_id = tag.tagId;
          return articleTag;
        });

        await queryRunner.manager.save(ArticleTag, articleTags);
        article.articleTags = articleTags;
      }

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
      
      const resultArticle = await this.articleRepository.findOne({
        where: { article_id: updatedArticle.article_id },
        relations: ["location", "articleTags", "articleTags.tag"]
      });

      return this.toArticleDTO(resultArticle!);
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
  }): Promise<IPaginatedArticlesResponse> {
    const { 
        page = PAGINATION_DEFAULTS.PAGE, 
        limit = PAGINATION_DEFAULTS.LIMIT, 
        status, 
        placeId, 
        categoryId,
        tag 
    } = options;
    const skip = (page - 1) * limit;

    const query = this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.location", "location")
      .leftJoinAndSelect("article.articleTags", "articleTags")
      .leftJoinAndSelect("articleTags.tag", "tag")
      .skip(skip)
      .take(limit)
      .orderBy("article.published_at", "DESC");

    if (status === ArticleStatus.PUBLISHED) {
      query.andWhere("article.published_at IS NOT NULL");
    } else if (status === ArticleStatus.DRAFT) {
      query.andWhere("article.published_at IS NULL");
    }

    if (placeId) {
      query.andWhere("article.location_id = :placeId", { placeId });
    }

    if (categoryId) {
      query.innerJoin(
        "location.categoryMappings",
        "categoryMapping",
        "categoryMapping.location_id = location.location_id"
      ).andWhere("categoryMapping.category_id = :categoryId", { categoryId });
    }

    if (tag) {
      query.innerJoin(
        "article.articleTags",
        "filterTagRelation",
        "filterTagRelation.article_id = article.article_id"
      ).innerJoin(
          "filterTagRelation.tag",
          "filterTag",
          "filterTag.slug = :tag",
          { tag }
      );
    }

    const [articles, count] = await query.getManyAndCount();

    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );

    return { 
        articles: articles.map((a, index) => this.toArticleDTO(a, enrichedArticles[index])), 
        count 
    };
  }

  async getAllArticles(includeAll: boolean = false): Promise<IArticleDTO[]> {
    const whereClause: FindOptionsWhere<Article> = {};
    if (!includeAll) whereClause.published_at = Not(IsNull());

    const articles = await this.articleRepository.find({
      where: whereClause,
      relations: [
        "articleTags",
        "articleTags.tag",
        "location",
        "location.categoryMappings",
        "location.attributes",
      ],
      order: { published_at: "DESC" },
    });
    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );
    return articles.map((a, index) => this.toArticleDTO(a, enrichedArticles[index]));
  }

  async searchArticles(term: string, includeAll: boolean = false): Promise<IArticleDTO[]> {
    const normalizedTerm = (term || "").trim();
    if (!normalizedTerm) {
      return [];
    }

    const query = this.articleRepository
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.articleTags", "articleTags")
      .leftJoinAndSelect("articleTags.tag", "tag")
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
      );
      
    if (!includeAll) {
      query.andWhere("article.published_at IS NOT NULL");
    }

    const articles = await query
      .orderBy("rank", "DESC")
      .addOrderBy("article.published_at", "DESC")
      .getMany();

    const enrichedArticles = await this.locationHelper.enrichArticlesWithCities(
      articles
    );
    return articles.map((a, index) => this.toArticleDTO(a, enrichedArticles[index]));
  }

  private generateSlug(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  }
}
