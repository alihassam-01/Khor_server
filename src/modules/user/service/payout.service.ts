import { AppDataSource } from "../../../config/ormconfig";
import { Payout } from "../entity/payout";
import { EntityManager } from "typeorm";

export class PayoutService {
  private repo = AppDataSource.getRepository(Payout);
  async create(data: Partial<Payout> & { manager?: EntityManager }) {
    const manager = data.manager ?? AppDataSource.manager;

    try {
      const payout = manager.create(Payout, data);
      return manager.save(Payout, payout);
    } catch (error) {
      throw error;
    }
  }

  async findAll(): Promise<Payout[]> {
    return this.repo.find({
      relations: ["vendor", "transaction"]
    });
  }

  async findOne(id: string): Promise<Payout | null> {
    return this.repo.findOneBy({ payout_id: id });
  }

  //update status
  async updateStatus(id: string, status: "pending" | "completed" | "failed"): Promise<Payout | null> {
    await this.repo.update({ payout_id: id }, { status });
    return this.findOne(id);
  }

  async update(id: string, data: Partial<Payout>): Promise<Payout | null> {
    await this.repo.update({ payout_id: id }, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete({ payout_id: id });
    return result.affected !== 0;
  }
}
