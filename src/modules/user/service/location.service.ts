import { Repository } from "typeorm";
import {
  Location,
  LocationAttributes,
  LocationCategoryMapping,
  LocationCategory,
} from "@entity/location";
import { DataSource } from "typeorm";
import { Address } from "@entity/address";

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
    this.categoryMappingRepository = dataSource.getRepository(
      LocationCategoryMapping
    );
    this.addressRepository = dataSource.getRepository(Address);
  }

  // Location CRUD Operations
  async createLocation(locationData: any): Promise<Location> {
    const location = new Location();
    location.name = locationData.name;
    location.slug = this.generateSlug(locationData.name);
    location.description = locationData.description;
    location.latitude = locationData.latitude;
    location.longitude = locationData.longitude;
    location.location_order = locationData.location_order || 0;

    if (locationData.parent_location_id !== undefined) {
      location.parent = locationData.parent_location_id;
    }
    const savedLocation = await this.locationRepository.save(location);
    // Add attributes if provided
    if (locationData.attributes) {
      await this.setLocationAttributes(
        savedLocation.location_id,
        locationData.attributes
      );
    }

    // Add categories if provided
    if (locationData.categories) {
      await this.addLocationToCategories(
        savedLocation.location_id,
        locationData.categories
      );
    }

    return savedLocation;
  }

  async getLocationById(locationId: number): Promise<Location | null> {
    return await this.locationRepository.findOne({
      where: { location_id: locationId },
      relations: [
        "attributes",
        "categoryMappings",
        "categoryMappings.category",
      ],
    });
  }

  async getLocationBySlug(slug: string): Promise<Location | null> {
    return await this.locationRepository.findOne({
      where: { slug },
      relations: [
        "attributes",
        "categoryMappings",
        "categoryMappings.category",
      ],
    });
  }

  async updateLocation(
    locationId: number,
    locationData: any
  ): Promise<Location | null> {
    const location = await this.getLocationById(locationId);
    if (!location) {
      return null;
    }

    if (locationData.name) {
      location.name = locationData.name;
      location.slug = this.generateSlug(locationData.name);
    }
    if (locationData.description !== undefined)
      location.description = locationData.description;
    if (locationData.latitude !== undefined)
      location.latitude = locationData.latitude;
    if (locationData.longitude !== undefined)
      location.longitude = locationData.longitude;
    if (locationData.location_order !== undefined)
      location.location_order = locationData.location_order;
    if (locationData.parent_location_id !== undefined) {
      location.parent = locationData.parent_location_id;
    }
    // Update attributes if provided
    if (locationData.attributes) {
      await this.setLocationAttributes(locationId, locationData.attributes);
    }

    // Update categories if provided
    if (locationData.categories) {
      await this.setLocationCategories(locationId, locationData.categories);
    }

    return await this.locationRepository.save(location);
  }

  async deleteLocation(locationId: number): Promise<boolean> {
    const location = await this.getLocationById(locationId);
    if (!location) {
      return false;
    }

    // Delete will cascade to attributes and category mappings
    await this.locationRepository.remove(location);
    return true;
  }

  async getAllLocations(): Promise<Location[]> {
    return await this.locationRepository.find({
      relations: [
        "attributes",
        "categoryMappings",
        "categoryMappings.category",
      ],
      order: { location_order: "ASC" },
    });
  }

  // Location Attributes Operations
  async getLocationAttributes(
    locationId: number
  ): Promise<LocationAttributes[]> {
    return await this.attributesRepository.find({
      where: { location_id: locationId },
    });
  }

  async getLocationAttribute(
    locationId: number,
    key: string
  ): Promise<string | null> {
    const attribute = await this.attributesRepository.findOne({
      where: { location_id: locationId, attributeKey: key },
    });
    return attribute ? attribute.attributeValue : null;
  }

  async setLocationAttribute(
    locationId: number,
    key: string,
    value: string
  ): Promise<LocationAttributes> {
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

  async setLocationAttributes(
    locationId: number,
    attributes: Record<string, string>
  ): Promise<void> {
    const currentAttributes = await this.getLocationAttributes(locationId);

    // Update or create new attributes
    for (const [key, value] of Object.entries(attributes)) {
      const existingAttr = currentAttributes.find(
        (a) => a.attributeKey === key
      );
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

    // Remove attributes not in the new set
    for (const attr of currentAttributes) {
      if (!(attr.attributeKey in attributes)) {
        await this.attributesRepository.remove(attr);
      }
    }
  }

  async deleteLocationAttribute(
    locationId: number,
    key: string
  ): Promise<boolean> {
    const attribute = await this.attributesRepository.findOne({
      where: { location_id: locationId, attributeKey: key },
    });

    if (!attribute) {
      return false;
    }

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

  async addLocationToCategory(
    locationId: number,
    categoryId: number
  ): Promise<LocationCategoryMapping> {
    const existing = await this.categoryMappingRepository.findOne({
      where: { location_id: locationId, category_id: categoryId },
    });

    if (existing) {
      return existing;
    }

    const mapping = new LocationCategoryMapping();
    mapping.location_id = locationId;
    mapping.category_id = categoryId;
    return await this.categoryMappingRepository.save(mapping);
  }

  async addLocationToCategories(
    locationId: number,
    categoryIds: number[]
  ): Promise<void> {
    for (const categoryId of categoryIds) {
      await this.addLocationToCategory(locationId, categoryId);
    }
  }

  async setLocationCategories(
    locationId: number,
    categoryIds: number[]
  ): Promise<void> {
    // Remove existing mappings not in new set
    const currentMappings = await this.categoryMappingRepository.find({
      where: { location_id: locationId },
    });

    for (const mapping of currentMappings) {
      if (!categoryIds.includes(mapping.category_id)) {
        await this.categoryMappingRepository.remove(mapping);
      }
    }

    // Add new mappings
    for (const categoryId of categoryIds) {
      const exists = currentMappings.some((m) => m.category_id === categoryId);
      if (!exists) {
        await this.addLocationToCategory(locationId, categoryId);
      }
    }
  }

  async removeLocationFromCategory(
    locationId: number,
    categoryId: number
  ): Promise<boolean> {
    const mapping = await this.categoryMappingRepository.findOne({
      where: { location_id: locationId, category_id: categoryId },
    });

    if (!mapping) {
      return false;
    }

    await this.categoryMappingRepository.remove(mapping);
    return true;
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
      if (parent) {
        category.parentCategory = parent;
      }
    }

    return await this.categoryRepository.save(category);
  }

  async getAllCategories(): Promise<LocationCategory[]> {
    return await this.categoryRepository.find({
      relations: ["parentCategory"],
      order: { name: "ASC" },
    });
  }

  async getLocationsByCategoryName(categoryName: string) {
    console.log("Fetching locations for category:", categoryName);
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

  async createAddress(
    locationId: number,
    street_address: string,
    landmark: string,
    is_primary: boolean
    ): Promise<Address> {
    const location = await this.getLocationById(locationId);
    if (!location) {
        throw new Error("Location not found");
        }
    const address = new Address();
    address.location = location;
    address.street_address = street_address;
    address.landmark = landmark;
    address.is_primary = is_primary;
    const addressSaved =  await this.addressRepository.save(address);
    return addressSaved;
    }
  // Utility Methods
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove non-word chars
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/--+/g, "-") // Replace multiple - with single -
      .trim();
  }
}
