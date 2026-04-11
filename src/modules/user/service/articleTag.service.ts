import { AppDataSource } from "@config/ormconfig";
import { ArticleTag } from "@modules/user/entity/article";
import { IArticleTagPair } from "@modules/user/types";

export class ArticleTagService {
  private repo = AppDataSource.getRepository(ArticleTag);

  async create(articleId: number, tagId: number): Promise<ArticleTag> {
    const articleTag = this.repo.create({ article_id: articleId, tag_id: tagId });
    return this.repo.save(articleTag);
  }

  async bulkCreate(pairs: IArticleTagPair[]): Promise<ArticleTag[]> {
    const tags = this.repo.create(pairs);
    return this.repo.save(tags);
  }

  async findTagsByArticle(articleId: number): Promise<ArticleTag[]> {
    return this.repo.find({
      where: { article_id: articleId },
      relations: ["tag"],
    });
  }

  async findArticlesByTag(tagId: number): Promise<ArticleTag[]> {
    return this.repo.find({
      where: { tag_id: tagId },
      relations: ["article"],
    });
  }

  async delete(articleId: number, tagId: number): Promise<{ success: boolean }> {
    await this.repo.delete({ article_id: articleId, tag_id: tagId });
    return { success: true };
  }

  async deleteByArticle(articleId: number): Promise<{ success: boolean }> {
    await this.repo.delete({ article_id: articleId });
    return { success: true };
  }

  async deleteByTag(tagId: number): Promise<{ success: boolean }> {
    await this.repo.delete({ tag_id: tagId });
    return { success: true };
  }
}
