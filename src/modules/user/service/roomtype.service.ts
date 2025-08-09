import { AppDataSource } from "@config/ormconfig";
import { RoomType } from "../entity/room";
import { ILike } from "typeorm";
import { LocationHelperService } from "./helper/location-helper.service";
import { Property } from "@entity/property";
import { S3ClientService } from "./s3client.service";

export class RoomTypeService {
  private repo = AppDataSource.getRepository(RoomType);
  private locationHelper = new LocationHelperService();
  private propertyRepo = AppDataSource.getRepository(Property);
  private s3ClientService = new S3ClientService();
  /**
   * Create a new room type
   */
  async create(data: Partial<RoomType>) {
    const roomType = this.repo.create(data);
    return this.repo.save(roomType);
  }

  /**
   * Get all room types
   */
  async findAll() {
    const roomTypes = await this.repo.find({
      relations: [
        "property",
        "property.address",
        "property.address.location",
        "property.address.location.parent",
      ],
    });

    const enrichedRoomTypes = await Promise.all(
      roomTypes.map(async (roomType: RoomType) => {
        if (roomType.property) {
          roomType.property = await this.locationHelper.enrichWithLocationData(roomType.property);
        }
        return roomType;
      })
    );

    return enrichedRoomTypes;
  }

  /**
   * Get a room type by ID
   */
  async findById(roomId: string) {
    const properties = await this.propertyRepo.find({
      where: { roomTypes: { id: roomId } },
      relations: ["address", "address.location", "address.location.parent"],
    });
    const enrichedProperty = await Promise.all(
      properties.map((property: Property) =>
        this.locationHelper.enrichWithLocationData(property)
      )
    );
    // Create a map for quick lookup
    // const propertyMap = new Map(enrichedProperties.map((p) => [p.id, p]));

    const room = await this.repo.findOne({ where: { id: roomId } });

    return {
      room,
      property: enrichedProperty,
    };
  }

  /**
   * Get room types by property ID
   */
  async findByProperty(propertyId: string) {
    return this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property"],
    });
  }

  /**
   * Update a room type by ID
   */
  async update(id: string, updates: Partial<RoomType>) {
    const { images } = updates;
    const existingRoom = await this.repo.findOne({
      where: { id },
      relations: ["property"],
    });
    const deletedImages = existingRoom?.images?.filter(
      (img) => !images?.includes(img)
    );
    if (deletedImages && deletedImages.length > 0) {
      await this.s3ClientService.deleteFileFromS3(deletedImages);
    }
    await this.repo.update(id, updates);
    return this.findById(id);
  }

  /**
   * Soft delete (set active = false)
   */
  async deactivate(id: string) {
    const room = await this.repo.findOne({ where: { id } });
    if (room) {
      await this.repo.update(id, { active: !room.active });
    }
    return { success: true };
  }

  /**
   * Hard delete room type
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }

  /**
   * Search room types by name or description
   */
  async search(term: string) {
    return this.repo.find({
      where: [
        { name: ILike(`%${term}%`) },
        { description: ILike(`%${term}%`) },
      ],
      relations: ["property"],
    });
  }
}
