import { AppDataSource } from "@config/ormconfig";
import { TourPackage } from "../entity/property/tour-package.entity";

export class TourPackageService {
  private repo = AppDataSource.getRepository(TourPackage);

  create(data: Partial<TourPackage>) {
    const tp = this.repo.create(data);
    return this.repo.save(tp);
  }

  findByProperty(propertyId: string) {
    return this.repo.find({ where: { property: { id: propertyId } }, relations: ['property'] });
  }
}