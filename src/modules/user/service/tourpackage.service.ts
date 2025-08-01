import { AppDataSource } from "@config/ormconfig";
import { TourPackage } from "@modules/user/entity/property";
import { ILike, In } from "typeorm";
import { Location } from "@entity/location";
import { LocationHelperService } from "./helper/location-helper.service";

export class TourPackageService {
  private repo = AppDataSource.getRepository(TourPackage);
  private locationRepo = AppDataSource.getRepository(Location);
  private locationHelper = new LocationHelperService();
  /**
   * Create a new tour package
   */
  async create(data: Partial<TourPackage>) {
    // Handle destinations if provided as IDs
    let destinationEntities: Location[] | undefined = undefined;

    if (data.destinations && Array.isArray(data.destinations)) {
      destinationEntities = await this.locationRepo.find({
        where: {
          location_id: In(data.destinations),
        },
      });
    }

    const tour = this.repo.create({
      ...data,
      destinations: destinationEntities,
    });

    return this.repo.save(tour);
  }

  /**
   * Get all tour packages
   */
  async findAll() {
    return this.repo.find({ relations: ["property", "destinations"] });
  }

  /**
   * Get a tour package by ID
   */
  async findById(id: string) {
    const tour = await this.repo.findOne({
      where: { id },
      relations: [
        "property",
        "property.address",
        "property.address.location",
        "destinations",
      ],
    });

    if (!tour) return null;

    // Enrich property with location data if it exists
    if (tour.property) {
      return {
        ...tour,
        property: await this.locationHelper.enrichWithLocationData(
          tour.property
        ),
      };
    }

    return tour;
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
    try {
      const { destinations, ...rest } = updates;

      // Update scalar fields first
      await this.repo.update(id, rest);

      // If destinations (array of location IDs) is provided
      if (destinations && Array.isArray(destinations)) {
        // Fetch the corresponding Location entities
        const locationEntities = await this.locationRepo.findBy({
          location_id: In(destinations),
        });

        if (locationEntities.length !== destinations.length) {
          throw new Error("Some destination IDs were not found.");
        }

        // Load existing tour package with its relations
        const tour = await this.repo.findOne({
          where: { id },
          relations: ["destinations"],
        });

        if (!tour) throw new Error("Tour package not found");

        // Assign new destinations and save
        tour.destinations = locationEntities;
        await this.repo.save(tour);
      }

      // Return updated tour package
      return this.findById(id);
    } catch (error) {
      console.error("Error updating tour package:", error);
      throw error;
    }
  }

  //  get by location_id in location_id[]
  /**
   * Get tour packages by location IDs, where locationIds is an array of numbers
   */
  async findByLocationId(locationIds: number[]) {
    return this.repo.find({
      where: {
        destinations: In(locationIds),
      },
      relations: ["property", "destinations"],
    });
  }
  /**
   * Get tour packages by a single location ID
   */
  async findBySingleLocationId(locationId: number) {
    return this.repo
      .createQueryBuilder("tourPackage")
      .leftJoinAndSelect("tourPackage.property", "property")
      .leftJoinAndSelect("tourPackage.destinations", "destination")
      .where("destination.location_id = :locationId", { locationId })
      .getMany();
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
