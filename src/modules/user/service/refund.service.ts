import { AppDataSource } from "@config/ormconfig";
import { Refund } from "../entity/bookings";

export class RefundService {
  private repo = AppDataSource.getRepository(Refund);
  async create(data: Partial<Refund>): Promise<Refund> {
    const refund = this.repo.create(data);
    return this.repo.save(refund);
  }

  async findAll(): Promise<Refund[]> {
    console.log("Fetching all refunds");
    return this.repo.find({
      relations: ["booking"],
    });
  }

  async findOne(id: string): Promise<Refund | null> {
    return this.repo.findOneBy({ id });
  }

  async update(id: string, data: Partial<Refund>): Promise<Refund | null> {
    await this.repo.update({ id }, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id });
    return result.affected !== 0;
  }
}
