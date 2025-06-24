import { AppDataSource } from "@config/ormconfig";
import { TourPackage } from "@modules/user/entity/property";
import { ILike } from "typeorm";

export class TourPackageService {
  private repo = AppDataSource.getRepository(TourPackage);

  /**
   * Create a new tour package
   */
  async create(data: Partial<TourPackage>) {
    const tour = this.repo.create(data);
    return this.repo.save(tour);
  }

  /**
   * Get all tour packages
   */
  async findAll() {
    return this.repo.find({ relations: ["property"] });
  }

  /**
   * Get a tour package by ID
   */
  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ["property"] });
  }

  /**
   * Get tour packages by property ID
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property"],
    });
  }

  /**
   * Update a tour package by ID
   */
  async update(id: string, updates: Partial<TourPackage>) {
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
   * Hard delete tour package
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * Search tour packages by name, difficulty, or includes
   */
  async search(term: string) {
    return this.repo.find({
      where: [
        { name: ILike(`%${term}%`) },
        { description: ILike(`%${term}%`) },
        // { difficulty_level: ILike(`%${term}%`) },
      ],
      relations: ["property"],
    });
  }
}
