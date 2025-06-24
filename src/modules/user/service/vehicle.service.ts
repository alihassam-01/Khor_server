import { AppDataSource } from "@config/ormconfig";
import { Vehicle } from "../entity/property/vehicle.entity";

export class VehicleService {
  private repo = AppDataSource.getRepository(Vehicle);

  create(data: Partial<Vehicle>) {
    const vehicle = this.repo.create(data);
    return this.repo.save(vehicle);
  }

  findByProperty(propertyId: string) {
    return this.repo.find({ where: { property: { id: propertyId } }, relations: ['property'] });
  }
}