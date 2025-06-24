import { AppDataSource } from "@config/ormconfig";
import { Deal } from "../entity/bookings/deal.entity";
// import { Deal } from "@getbrevo/brevo";

export class DealService {
  private repo = AppDataSource.getRepository(Deal);

  async create(data: Partial<Deal>) {
    const deal = this.repo.create(data);
    return this.repo.save(deal);
  }

  async findByProperty(propertyId: string) {
    return this.repo.find({ where: { property: { id: propertyId } }, relations: ['property'] });
  }
}