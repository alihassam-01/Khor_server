import { AppDataSource } from "../../../config/ormconfig";
import { Tag } from "../entity/article";

export class TagService {
  private repo = AppDataSource.getRepository(Tag);

  async create(data: Partial<Tag>) {
    const tag = this.repo.create(data);
    return this.repo.save(tag);
  }

  async findAll() {
    return this.repo.find({ relations: ["articleTags"] });
  }

  async findById(tagId: number) {
    return this.repo.findOne({
      where: { tagId },
      relations: ["articleTags"],
    });
  }

  async findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  async update(tagId: number, updates: Partial<Tag>) {
    await this.repo.update(tagId, updates);
    return this.findById(tagId);
  }

  async delete(tagId: number) {
    await this.repo.delete(tagId);
    return { success: true };
  }
}
