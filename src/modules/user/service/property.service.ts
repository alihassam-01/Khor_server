import { AppDataSource } from "@config/ormconfig";
import { Property } from "../entity/property";
import { FindOptionsWhere, ILike, In } from "typeorm";
import { CreateProperty } from "../dtos/property.dto";
import { LocationService } from "./location.service";
// import { City } from "@entity/address";
import { LocationHelperService } from "./helper/location-helper.service";

export class PropertyService {
  private repo = AppDataSource.getRepository(Property);
  private locationService = new LocationService(AppDataSource);
  // private cityRepository = AppDataSource.getRepository(City);
  private locationHelper = new LocationHelperService();
  /**
   * Create a new property
   */
  async create(data: CreateProperty) {
    // pass the name = data.name, description = data.description, parent_id= data.localityId and data.latitude, longitude to the location entity create location and get locationId
    const location = await this.locationService.createLocation({
      name: data.name,
      description: data.description,
      parent_location_id: data.localityId as unknown as number,
      plusCode: data.plusCode,
    });
    // create a address with, location_id = locationId, street_address = data.streetAddress, landmark = data.landmark, is_primary = false
    const address = await this.locationService.createAddress({
      locationId: location.location_id,
      street_address: data.streetAddress || "",
      landmark: data.landmark || "",
      is_primary: false,
    });
    const property = this.repo.create({
      name: data.name,
      description: data.description,
      vendor: { id: data.vendorId },
      type: data.type as "hotel" | "car_rental" | "tour",
      amenities: data.amenities,
      images: data.images,
      active: data.isActive,
      address,
    });
    return await this.repo.save(property);
  }
  
  async getPropertiesByLocationId(locationId: number) {
    const location = await this.locationService.getLocationById(locationId);
    if (!location) throw new Error("Location not found");

    const childrenLocations = await this.locationService.getLocationChildren(
      locationId
    );
    const addresses = await this.locationService.getAddressesByLocationId(
      childrenLocations
    );
    const addressIds = addresses.map((address) => address.address_id);

    const properties = await this.repo.find({
      where: { address: { address_id: In(addressIds) } },
      relations: [
        "vendor",
        "roomTypes",
        "vehicles",
        "tourPackages",
        "deals",
        "address",
        "address.location",
        "address.location.parent",
      ],
    });

    const enrichedProperties = await Promise.all(
      properties.map((property) => this.locationHelper.enrichWithLocationData(property))
    );

    return enrichedProperties;
  }

  /**
   * Get property by ID
   */
  async findById(id: string) {
    return await this.repo.findOne({
      where: { id },
      relations: ["vendor", "roomTypes", "vehicles", "tourPackages", "deals"],
    });
  }
  /**
   * Get property by vendorID
   */
  async findByVendorId(vendorId: string) {
    return await this.repo.findOne({
      where: { vendor: { id: vendorId } },
      relations: ["vendor", "roomTypes", "vehicles", "tourPackages", "deals"],
    });
  }
  /**
   * Get property by name
   */
  async findByName(name: string) {
    return await this.repo.findOne({
      where: { name: ILike(`%${name}%`) },
      relations: ["vendor", "roomTypes", "vehicles", "tourPackages", "deals"],
    });
  }

  /**
   * Get all properties
   */
  async findAll() {
    return await this.repo.find({
      relations: ["vendor", "roomTypes", "vehicles", "tourPackages", "deals"],
    });
  }

  /**
   * Find properties by vendor ID
   */
  async findByVendor(vendorId: string) {
    return await this.repo.find({
      where: { vendor: { id: vendorId } },
      relations: ["vendor", "roomTypes", "vehicles", "tourPackages", "deals"],
    });
  }

  /**
   * Search properties by name/location/type
   */
  async search(term: string) {
    // Only allow exact match for 'type' since it's a string literal union
    const allowedTypes = ["hotel", "car_rental", "tour"];
    const where: FindOptionsWhere<Property>[] = [
      { name: ILike(`%${term}%`) },
      { description: ILike(`%${term}%`) },
      ...(allowedTypes.includes(term) ? [{ type: term as any }] : []),
    ];
    return await this.repo.find({
      where,
      relations: ["vendor"],
    });
  }

  /**
   * Update a property by ID
   */
  async update(id: string, updates: Partial<Property>) {
    await this.repo.update(id, updates);
    return this.findById(id);
  }

  /**
   * Soft delete (set active = false)
   */
  async deactivate(id: string) {
    await this.repo.update(id, { active: false });
    return { success: true };
  }

  /**
   * Permanently delete a property
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }
}
