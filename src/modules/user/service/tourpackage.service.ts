import { AppDataSource } from "@config/ormconfig";
import { TourPackage } from "@modules/user/entity/property";
import { ILike, In } from "typeorm";
import { Location } from "@entity/location";
import { LocationHelperService } from "./helper/location-helper.service";
import { S3ClientService } from "./s3client.service";

export class TourPackageService {
  private repo = AppDataSource.getRepository(TourPackage);
  private locationRepo = AppDataSource.getRepository(Location);
  private locationHelper = new LocationHelperService();
  private s3ClientService = new S3ClientService();
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
    const { destinations, images, ...rest } = updates;
    // Fetch existing tour package with images and destinations
    const existingTour = await this.repo.findOne({
      where: { id },
      relations: ["destinations"],
    });
    if (!existingTour) throw new Error("Tour package not found");

    // Handle deleted images
    if (images && existingTour.images) {
      const deletedImages = existingTour.images.filter(
        (img) => !images.includes(img)
      );
      if (deletedImages.length > 0) {
        await this.s3ClientService.deleteFileFromS3(deletedImages);
      }
    }

    // Prepare update object
    Object.assign(existingTour, rest);
    if (images) existingTour.images = images;

    // Handle destinations update if provided
    if (destinations && Array.isArray(destinations)) {
      const locationEntities = await this.locationRepo.findBy({
        location_id: In(destinations),
      });
      if (locationEntities.length !== destinations.length) {
        throw new Error("Some destination IDs were not found.");
      }
      existingTour.destinations = locationEntities;
    }

    await this.repo.save(existingTour);
    return this.findById(id);
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
