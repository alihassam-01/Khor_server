import { AppDataSource } from "@config/ormconfig";
import { RoomType } from "../entity/room";

export class RoomTypeService {
  private repo = AppDataSource.getRepository(RoomType);

  create(data: Partial<RoomType>) {
    const roomType = this.repo.create(data);
    return this.repo.save(roomType);
  }

  findByProperty(propertyId: string) {
    return this.repo.find({ where: { property: { id: propertyId } }, relations: ['property'] });
  }
}