import { In, Repository } from "typeorm";
import {
  Location,
  LocationAttributes,
  LocationCategoryMapping,
  LocationCategory,
} from "../entity/location";
import { DataSource } from "typeorm";
import { Address } from "@modules/user/entity/address";
import { ICreateLocationDto } from "@modules/user/dtos/location.dto";
import { LocationType } from "@modules/user/entity/ENUM/enum";

export class LocationService {
  private locationRepository: Repository<Location>;
  private attributesRepository: Repository<LocationAttributes>;
  private categoryRepository: Repository<LocationCategory>;
  private categoryMappingRepository: Repository<LocationCategoryMapping>;
  private addressRepository: Repository<Address>;

  constructor(dataSource: DataSource) {
    this.locationRepository = dataSource.getRepository(Location);
    this.attributesRepository = dataSource.getRepository(LocationAttributes);
    this.categoryRepository = dataSource.getRepository(LocationCategory);
    this.categoryMappingRepository = dataSource.getRepository(LocationCategoryMapping);
    this.addressRepository = dataSource.getRepository(Address);
  }

  // Location CRUD Operations
  async createLocation(locationData: ICreateLocationDto): Promise<Location> {
    const location = new Location();
    location.name = locationData.name;
    location.slug = this.generateSlug(locationData.name);
    location.description = locationData.description ?? "";
    location.plusCode = locationData.plusCode || "";
    location.location_order = locationData.location_order || 0;
    location.location_type = locationData.location_type ?? LocationType.PLACE;

    if (locationData.parent_location_id !== undefined && locationData.parent_location_id !== null) {
      const parentLocation = await this.locationRepository.findOne({
        where: { location_id: locationData.parent_location_id },
      });
      if (parentLocation) {
        location.parent = parentLocation;
      }
    }

    const savedLocation = await this.locationRepository.save(location);

    if (locationData.attributes) {
      const attributesObj: Record<string, string> = Array.isArray(locationData.attributes)
        ? locationData.attributes.reduce((acc, attr) => {
            if (attr.attributeKey && attr.attributeValue !== undefined) {
              acc[attr.attributeKey] = attr.attributeValue;
            }
            return acc;
          }, {} as Record<string, string>)
        : locationData.attributes;
      await this.setLocationAttributes(savedLocation.location_id, attributesObj);
    }

    if (locationData.categories) {
      await this.addLocationToCategories(savedLocation.location_id, locationData.categories);
    }

    return savedLocation;
  }

  async getLocationById(locationId: number): Promise<Location | null> {
    return await this.locationRepository.findOne({
      where: { location_id: locationId },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
  }

  async getLocationBySlug(slug: string): Promise<Location | null> {
    return await this.locationRepository.findOne({
      where: { slug },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
  }

  async getLocationsByIds(ids: number[]): Promise<Location[]> {
    return await this.locationRepository.find({
      where: { location_id: In(ids) },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
  }

  async updateLocation(locationId: number, locationData: any): Promise<Location | null> {
    const location = await this.getLocationById(locationId);
    if (!location) return null;

    if (locationData.name) {
      location.name = locationData.name;
      location.slug = this.generateSlug(locationData.name);
    }
    if (locationData.description !== undefined) location.description = locationData.description;
    if (locationData.plusCode !== undefined) location.plusCode = locationData.plusCode;
    if (locationData.location_order !== undefined) location.location_order = locationData.location_order;
    if (locationData.location_type !== undefined) location.location_type = locationData.location_type;

    if (locationData.parent_location_id !== undefined) {
      if (locationData.parent_location_id === null) {
        location.parent = null as any;
      } else {
        const parentLocation = await this.locationRepository.findOne({
          where: { location_id: locationData.parent_location_id },
        });
        if (parentLocation) location.parent = parentLocation;
      }
    }

    if (locationData.attributes) {
      await this.setLocationAttributes(locationId, locationData.attributes);
    }

    if (locationData.categories) {
      await this.setLocationCategories(locationId, locationData.categories);
    }

    return await this.locationRepository.save(location);
  }

  async deleteLocation(locationId: number): Promise<boolean> {
    const location = await this.getLocationById(locationId);
    if (!location) return false;
    await this.locationRepository.remove(location);
    return true;
  }

  async getAllLocations(): Promise<Location[]> {
    return await this.locationRepository.find({
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
      order: { location_order: "ASC" },
    });
  }

  /** Returns all locations with location_type = 'city' */
  async getAllCities(): Promise<Location[]> {
    return await this.locationRepository.find({
      where: { location_type: LocationType.CITY },
      relations: ["parent"],
      order: { location_order: "ASC" },
    });
  }

  /** Returns locations filtered by type */
  async getLocationsByType(type: LocationType): Promise<Location[]> {
    return await this.locationRepository.find({
      where: { location_type: type },
      relations: ["parent"],
      order: { location_order: "ASC" },
    });
  }

  /**
   * Walk up the parent chain to find the nearest ancestor (or self) with location_type = 'city'
   */
  async getCityByLocationId(locationId: number): Promise<string | null> {
    if (!locationId) throw new Error("Location ID is required");

    let current = await this.locationRepository.findOne({
      where: { location_id: locationId },
      relations: ["parent"],
    });

    const visited = new Set<number>();
    while (current) {
      if (visited.has(current.location_id)) break;
      visited.add(current.location_id);

      if (current.location_type === LocationType.CITY) {
        return current.name;
      }

      if (current.parent?.location_id) {
        current = await this.locationRepository.findOne({
          where: { location_id: current.parent.location_id },
          relations: ["parent"],
        });
      } else {
        break;
      }
    }

    return null;
  }

  // Location Attributes Operations
  async getLocationAttributes(locationId: number): Promise<LocationAttributes[]> {
    return await this.attributesRepository.find({ where: { location_id: locationId } });
  }

  async getLocationAttribute(locationId: number, key: string): Promise<string | null> {
    const attribute = await this.attributesRepository.findOne({
      where: { location_id: locationId, attributeKey: key },
    });
    return attribute ? attribute.attributeValue : null;
  }

  async setLocationAttribute(locationId: number, key: string, value: string): Promise<LocationAttributes> {
    let attribute = await this.attributesRepository.findOne({
      where: { location_id: locationId, attributeKey: key },
    });
    if (!attribute) {
      attribute = new LocationAttributes();
      attribute.location_id = locationId;
      attribute.attributeKey = key;
    }
    attribute.attributeValue = value;
    return await this.attributesRepository.save(attribute);
  }

  async setLocationAttributes(locationId: number, attributes: Record<string, string>): Promise<void> {
    const currentAttributes = await this.getLocationAttributes(locationId);

    for (const [key, value] of Object.entries(attributes)) {
      const existingAttr = currentAttributes.find((a) => a.attributeKey === key);
      if (existingAttr) {
        existingAttr.attributeValue = value;
        await this.attributesRepository.save(existingAttr);
      } else {
        const newAttr = new LocationAttributes();
        newAttr.location_id = locationId;
        newAttr.attributeKey = key;
        newAttr.attributeValue = value;
        await this.attributesRepository.save(newAttr);
      }
    }

    for (const attr of currentAttributes) {
      if (!(attr.attributeKey in attributes)) {
        await this.attributesRepository.remove(attr);
      }
    }
  }

  async deleteLocationAttribute(locationId: number, key: string): Promise<boolean> {
    const attribute = await this.attributesRepository.findOne({
      where: { location_id: locationId, attributeKey: key },
    });
    if (!attribute) return false;
    await this.attributesRepository.remove(attribute);
    return true;
  }

  // Location Category Operations
  async getLocationCategories(locationId: number): Promise<LocationCategory[]> {
    const mappings = await this.categoryMappingRepository.find({
      where: { location_id: locationId },
      relations: ["category"],
    });
    return mappings.map((mapping) => mapping.category);
  }

  async addLocationToCategory(locationId: number, categoryId: number): Promise<LocationCategoryMapping> {
    const existing = await this.categoryMappingRepository.findOne({
      where: { location_id: locationId, category_id: categoryId },
    });
    if (existing) return existing;

    const mapping = new LocationCategoryMapping();
    mapping.location_id = locationId;
    mapping.category_id = categoryId;
    return await this.categoryMappingRepository.save(mapping);
  }

  async addLocationToCategories(locationId: number, categoryIds: number[]): Promise<void> {
    for (const categoryId of categoryIds) {
      await this.addLocationToCategory(locationId, categoryId);
    }
  }

  async setLocationCategories(locationId: number, categoryIds: number[]): Promise<void> {
    const currentMappings = await this.categoryMappingRepository.find({
      where: { location_id: locationId },
    });

    for (const mapping of currentMappings) {
      if (!categoryIds.includes(mapping.category_id)) {
        await this.categoryMappingRepository.remove(mapping);
      }
    }

    for (const categoryId of categoryIds) {
      const exists = currentMappings.some((m) => m.category_id === categoryId);
      if (!exists) {
        await this.addLocationToCategory(locationId, categoryId);
      }
    }
  }

  async removeLocationFromCategory(locationId: number, categoryId: number): Promise<boolean> {
    const mapping = await this.categoryMappingRepository.findOne({
      where: { location_id: locationId, category_id: categoryId },
    });
    if (!mapping) return false;
    await this.categoryMappingRepository.remove(mapping);
    return true;
  }

  async getLocationsByCategoryName(categoryName: string) {
    return this.locationRepository
      .createQueryBuilder("location")
      .leftJoin("location.categoryMappings", "mapping")
      .leftJoin("mapping.category", "category")
      .where("category.name = :name", { name: categoryName })
      .getMany();
  }

  async getLocationChildren(locationId: number): Promise<Location[]> {
    return await this.locationRepository.find({
      where: { parent: { location_id: locationId } },
      order: { location_order: "ASC" },
    });
  }

  async getAllDescendants(locationId: number): Promise<Location[]> {
    const descendants: Location[] = [];
    const stack: number[] = [locationId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const children = await this.getLocationChildren(currentId);
      descendants.push(...children);
      for (const child of children) {
        stack.push(child.location_id);
      }
    }
    return descendants;
  }

  // Category CRUD Operations
  async createCategory(categoryData: any): Promise<LocationCategory> {
    const category = new LocationCategory();
    category.name = categoryData.name;
    category.slug = this.generateSlug(categoryData.name);
    if (categoryData.parentCategoryId) {
      const parent = await this.categoryRepository.findOne({
        where: { categoryId: categoryData.parentCategoryId },
      });
      if (parent) category.parentCategory = parent;
    }
    return await this.categoryRepository.save(category);
  }

  async getAllCategories(): Promise<LocationCategory[]> {
    return await this.categoryRepository.find({
      relations: ["parentCategory"],
      order: { name: "ASC" },
    });
  }

  async getCategoryById(categoryId: number): Promise<LocationCategory | null> {
    return await this.categoryRepository.findOne({
      where: { categoryId },
      relations: ["parentCategory", "subcategories"],
    });
  }

  async getCategoryBySlug(slug: string): Promise<LocationCategory | null> {
    return await this.categoryRepository.findOne({
      where: { slug },
      relations: ["parentCategory", "subcategories"],
    });
  }

  async createAddress({ locationId, street_address, landmark, is_primary }: {
    locationId: number;
    street_address: string;
    landmark: string;
    is_primary: boolean;
  }): Promise<Address> {
    const location = await this.getLocationById(locationId);
    if (!location) throw new Error("Location not found");
    const address = new Address();
    address.location = location;
    address.street_address = street_address;
    address.landmark = landmark;
    address.is_primary = is_primary;
    return await this.addressRepository.save(address);
  }

  async updateAddress(id: number, updates: Partial<Address>): Promise<Address | null> {
    const address = await this.addressRepository.findOne({
      where: { address_id: id },
      relations: ["location"],
    });
    if (!address) throw new Error("Address not found");
    Object.assign(address, updates);
    return await this.addressRepository.save(address);
  }

  async getAddressesByLocationId(Locations: Location[]): Promise<Address[]> {
    return await this.addressRepository.find({
      where: {
        location: {
          location_id: In(Locations.map((location) => location.location_id)),
        },
      },
      order: { is_primary: "DESC" },
    });
  }

  async getLocationHierarchy(location: Location): Promise<Location[]> {
    const hierarchy: Location[] = [];
    const visited = new Set<number>();

    if (!location.parent) {
      const foundLocation = await this.locationRepository.findOne({
        where: { location_id: location.location_id },
        relations: ["parent"],
      });
      if (!foundLocation) return hierarchy;
      location = foundLocation;
    }

    let current: Location | null = location;

    while (current) {
      if (visited.has(current.location_id)) break;
      visited.add(current.location_id);
      hierarchy.unshift(current);

      current = await this.locationRepository.findOne({
        where: { location_id: current.parent?.location_id },
        relations: ["parent"],
      });
    }

    return hierarchy;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  }
}
