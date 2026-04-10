import { AppDataSource } from "@config/ormconfig";
import { Tag } from "@modules/user/entity/article";
import { ITagDTO } from "@modules/user/dtos";
import { ICreateTagBody, IUpdateTagBody } from "@modules/user/types";

export class TagService {
  private repo = AppDataSource.getRepository(Tag);

  private toTagDTO(tag: Tag): ITagDTO {
      return {
          tagId: tag.tagId,
          name: tag.name,
          slug: tag.slug,
          articleCount: tag.articleTags?.length
      };
  }

  async create(data: ICreateTagBody): Promise<ITagDTO> {
    const tag = this.repo.create(data);
    const saved = await this.repo.save(tag);
    return this.toTagDTO(saved);
  }

  async findAll(): Promise<ITagDTO[]> {
    const tags = await this.repo.find({ relations: ["articleTags"] });
    return tags.map(t => this.toTagDTO(t));
  }

  async findById(tagId: number): Promise<ITagDTO | null> {
    const tag = await this.repo.findOne({
      where: { tagId },
      relations: ["articleTags"],
    });
    return tag ? this.toTagDTO(tag) : null;
  }

  async findBySlug(slug: string): Promise<ITagDTO | null> {
    const tag = await this.repo.findOne({ where: { slug }, relations: ["articleTags"] });
    return tag ? this.toTagDTO(tag) : null;
  }

  async update(tagId: number, updates: IUpdateTagBody): Promise<ITagDTO | null> {
    await this.repo.update(tagId, updates);
    return this.findById(tagId);
  }

  async delete(tagId: number): Promise<{ success: boolean }> {
    await this.repo.delete(tagId);
    return { success: true };
  }
}
