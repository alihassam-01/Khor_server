import { AppDataSource } from "@config/ormconfig";
import { Vehicle } from "../entity/property/vehicle.entity";
import { ILike } from "typeorm";

export class VehicleService {
  private repo = AppDataSource.getRepository(Vehicle);

  /**
   * Create a vehicle entry
   */
  async create(data: Partial<Vehicle>) {
    const vehicle = this.repo.create(data);
    return this.repo.save(vehicle);
  }

  /**
   * Get all vehicles with their associated property
   */
  async findAll() {
    return this.repo.find({ relations: ["property"] });
  }

  /**
   * Find vehicle by ID
   */
  async findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ["property"] });
  }

  /**
   * Get vehicles by property ID
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property"],
    });
  }

  /**
   * Update vehicle info
   */
  async update(id: string, updates: Partial<Vehicle>) {
    await this.repo.update(id, updates);
    return this.findById(id);
  }

  /**
   * Soft delete: deactivate vehicle
   */
  async deactivate(id: string) {
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) return { success: false, message: "Vehicle not found" };
    const newState = !vehicle.active;
    await this.repo.update(id, { active: newState });
    return { success: true, active: newState };
  }

  /**
   * Hard delete: remove record from DB
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * Search vehicles by model, make, type, or license_plate
   */
  async search(term: string) {
    return this.repo.find({
      where: [
        { make: ILike(`%${term}%`) },
        { model: ILike(`%${term}%`) },
        { type: ILike(`%${term}%`) },
        { license_plate: ILike(`%${term}%`) },
      ],
      relations: ["property"],
    });
  }
}
