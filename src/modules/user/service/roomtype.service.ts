import { AppDataSource } from "../../../config/ormconfig";
import { RoomType } from "../entity/room";
import { ILike, In } from "typeorm";
import { LocationHelperService } from "./helper/location-helper.service";
import { Property } from "../entity/property";
import { R2ClientService } from "./r2client.service";
import { ListingPriceService } from "./listingPrice.service";
import { ListingPrice } from "../entity/payout";
import { LocationService } from "./location.service";
import { BookingService } from "./bookings.service";

export class RoomTypeService {
  private repo = AppDataSource.getRepository(RoomType);
  private locationHelper = new LocationHelperService();
  private propertyRepo = AppDataSource.getRepository(Property);
  private r2ClientService = new R2ClientService();
  private listingPriceService = new ListingPriceService();
  private locationService = new LocationService(AppDataSource);
  private bookingService = new BookingService();

  /**
   * Create a new room type
   */
  async create(data: Partial<RoomType>) {
    //  go to listingPrice add the details for the room type: base_price, listing_price and profit
    const roomType = this.repo.create(data);
    // First, save the roomType to get its id
    const savedRoomType = await this.repo.save(roomType);
    const { base_price } = data;
    const listing = await this.listingPriceService.create({
      base_price,
      entity_type: "room",
      entity_id: savedRoomType.id,
      property: { id: savedRoomType.property.id } as Property,
    });
    savedRoomType.base_price = listing.selling_price;
    return this.repo.save(savedRoomType);
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
          roomType.property = await this.locationHelper.enrichWithLocationData(
            roomType.property
          );
        }
        return roomType;
      })
    );

    return enrichedRoomTypes;
  }
  /**
   * Get all room types for vendor with listing prices
   */
  async findAllForVendor() {
    return this.getRoomTypesWithListingPrices();
  }

  /**
   * Get room type by ID for vendor with listing price
   */
  async findByIdForVendor(roomId: string) {
    const result = await this.getRoomTypesWithListingPrices([roomId]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get room types by property ID for vendor with listing prices
   */
  async findByPropertyForVendor(propertyId: string) {
    const roomTypes = await this.repo.find({
      where: { property: { id: propertyId } },
      relations: ["property"],
    });
    return this.getRoomTypesWithListingPrices(roomTypes.map((rt) => rt.id));
  }

  /**
   * Search room types for vendor with listing prices
   */
  async searchForVendor(term: string) {
    const roomTypes = await this.repo.find({
      where: [
        { name: ILike(`%${term}%`) },
        { description: ILike(`%${term}%`) },
      ],
      relations: ["property"],
    });
    return this.getRoomTypesWithListingPrices(roomTypes.map((rt) => rt.id));
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
      await this.r2ClientService.deleteFileFromR2(deletedImages);
    }
    const listingRoom = await this.listingPriceService.findByIdAndType(
      id,
      "room"
    );
    if (listingRoom && updates.base_price != listingRoom?.base_price) {
      const savedListing = await this.listingPriceService.update(
        listingRoom.id,
        {
          base_price: updates.base_price,
        }
      );
      updates.base_price = savedListing?.selling_price;
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
   * Get roomtypes by Location, checkindate and checkoutdate
   * Returns all rooms in the location with no bookings in the given dates
   */
  async RoomTypesByDate(
    location: string,
    check_in_date: string,
    check_out_date: string
  ) {
    const children = await this.locationService.getAllDescendants(
      Number(location)
    );
    const addresses = await this.locationService.getAddressesByLocationId(
      children
    );
    const addressIds = addresses.map((address) => address.address_id);
    const properties = await this.propertyRepo.find({
      where: { address: { address_id: In(addressIds) } },
      relations: ["address", "address.location"],
    });
    const propertyIds = properties.map((p) => p.id);

    // Find all room types in these properties
    const roomTypes = await this.repo.find({
      where: { property: { id: In(propertyIds) } },
      relations: ["property"],
    });

    const bookedRoomIdsRaw = await this.bookingService.getBookedRooms(
      check_in_date,
      check_out_date
    );

    const bookedRoomIds = bookedRoomIdsRaw.map(
      (b: any) => b.booking_roomTypeId
    );

    // Filter out booked rooms
    const availableRoomTypes = roomTypes.filter(
      (roomType) => !bookedRoomIds.includes(roomType.id)
    );
    return availableRoomTypes;
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

  /**
   * Helper method to enrich room types with listing prices
   */
  private async getRoomTypesWithListingPrices(roomIds?: string[]) {
    const where = roomIds ? { id: In(roomIds) } : {};

    const roomTypes = await this.repo.find({
      where,
      relations: [
        "property",
        "property.address",
        "property.address.location",
        "property.address.location.parent",
      ],
    });

    const result = await this.listingPriceService.findByIdAndType(
      roomTypes.map((roomType) => roomType.id),
      "room"
    );
    const listingPrices: Partial<ListingPrice>[] = Array.isArray(result)
      ? result
      : [];

    const listedRooms = roomTypes.map((roomType) => {
      const listing = listingPrices.find(
        (lp) => lp.entity_id === roomType.id && lp.entity_type === "room"
      );
      if (listing) {
        roomType.base_price = listing.base_price || 0;
        // You can add other listing price fields if needed
        // roomType.listing_price = listing.listing_price;
        // roomType.profit = listing.profit;
      }
      return roomType;
    });

    const enrichedRoomTypes = await Promise.all(
      listedRooms.map(async (roomType: RoomType) => {
        if (roomType.property) {
          roomType.property = await this.locationHelper.enrichWithLocationData(
            roomType.property
          );
        }
        return roomType;
      })
    );

    return enrichedRoomTypes;
  }
}
