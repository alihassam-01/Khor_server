import { AppDataSource } from "../../../config/ormconfig";
import { ListingPrice } from "../entity/payout";
import { In } from "typeorm";

export class ListingPriceService {
  private repo = AppDataSource.getRepository(ListingPrice);

  /*
  Create a new listing
  */
  async create(data: Partial<ListingPrice>) {
    const listingPrice = this.repo.create(data);
    return this.repo.save(listingPrice);
  }

  /**
   * Get all listings
   */
  async findAll() {
    return this.repo.find({
      relations: ['property']
    });
  }

  /**
   * Get a listing by ID
   */
  async findById(id: string) {
    return this.repo.findOne({ where: { entity_id: id } });
  }

  async findByIdAndType(id: string, type: string): Promise<ListingPrice | null>;
  async findByIdAndType(id: string[], type: string): Promise<ListingPrice[]>;
  async findByIdAndType(
    id: string[] | string,
    type: string
  ): Promise<ListingPrice | ListingPrice[] | null> {
    const where: any = {
      entity_type: type as "room" | "vehicle" | "tour",
    };
    if (Array.isArray(id)) {
      where.entity_id = In(id);
      const results = await this.repo.find({ where });
      return results;
    } else {
      where.entity_id = id;
      const result = await this.repo.findOne({ where });
      if (!result) {
        console.error(
          `ListingPrice not found for id: ${id} and type: ${type}`
        );
      }
      return result;
    }
  }

  /**
   * Update a listing by ID
   */
  async update(id: string, data: Partial<ListingPrice>) {
    await this.repo.update({ entity_id: id }, data);
    return this.findById(id);
  }

  /**
   * Delete a listing by ID
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  // change commission rate
  async changeCommissionRate(id: string, newRate: number) {
    const listing = await this.findById(id);
    if (!listing) {
      throw new Error("Listing not found");
    }
    listing.commission_rate = newRate;
    await this.repo.save(listing);
    return listing;
  }
}
