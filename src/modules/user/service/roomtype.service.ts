import { AppDataSource } from "@config/ormconfig";
import { RoomType } from "../entity/room";
import { ILike } from "typeorm";

export class RoomTypeService {
  private repo = AppDataSource.getRepository(RoomType);

  /**
   * Create a new room type
   */
  async create(data: Partial<RoomType>) {
    const roomType = this.repo.create(data);
    return this.repo.save(roomType);
  }

  /**
   * Get all room types
   */
  async findAll() {
    return this.repo.find({ relations: ["property"] });
  }

  /**
   * Get a room type by ID
   */
  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ["property"] });
  }

  /**
   * Get room types by property ID
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property"],
    });
  }

  /**
   * Update a room type by ID
   */
  async update(id: string, updates: Partial<RoomType>) {
    await this.repo.update(id, updates);
    return this.findById(id);
  }

  /**
   * Soft delete (set active = false)
   */
  async deactivate(id: string) {
    await this.repo.update(id, { active: false });
    return { success: true };
  }

  /**
   * Hard delete room type
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * Search room types by name or description
   */
  async search(term: string) {
    return this.repo.find({
      where: [
        { name: ILike(`%${term}%`) },
        { description: ILike(`%${term}%`) },
      ],
      relations: ["property"],
    });
  }
}
