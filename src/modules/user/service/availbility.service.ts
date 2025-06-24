import { AppDataSource } from "@config/ormconfig";
import { Availability } from "../entity/property/availbility.entity";

export class AvailabilityService {
  private repo = AppDataSource.getRepository(Availability);

  create(data: Partial<Availability>) {
    const avail = this.repo.create(data);
    return this.repo.save(avail);
  }

//   find(resourceType: string, resourceId: string, date: Date) {
//     return this.repo.findOne({ where: { resource_type: resourceType, resource_id: resourceId, date } });
//   }
}