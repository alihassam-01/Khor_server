import { AppDataSource } from "../../../config/ormconfig";
import { ArticleTag } from "../entity/article";

export class ArticleTagService {
  private repo = AppDataSource.getRepository(ArticleTag);

  async create(articleId: number, tagId: number) {
    const articleTag = this.repo.create({ article_id: articleId, tag_id: tagId });
    return this.repo.save(articleTag);
  }

  async bulkCreate(pairs: { article_id: number; tag_id: number }[]) {
    const tags = this.repo.create(pairs);
    return this.repo.save(tags);
  }

  async findTagsByArticle(articleId: number) {
    return this.repo.find({
      where: { article_id: articleId },
      relations: ["tag"],
    });
  }

  async findArticlesByTag(tagId: number) {
    return this.repo.find({
      where: { tag_id: tagId },
      relations: ["article"],
    });
  }

  async delete(articleId: number, tagId: number) {
    await this.repo.delete({ article_id: articleId, tag_id: tagId });
    return { success: true };
  }

  async deleteByArticle(articleId: number) {
    await this.repo.delete({ article_id: articleId });
    return { success: true };
  }

  async deleteByTag(tagId: number) {
    await this.repo.delete({ tag_id: tagId });
    return { success: true };
  }
}
