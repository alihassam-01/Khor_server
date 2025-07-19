import { In, Repository } from "typeorm";
import {
  Location,
  LocationAttributes,
  LocationCategoryMapping,
  LocationCategory,
} from "@entity/location";
import { DataSource } from "typeorm";
import { Address, City } from "@entity/address";
import { CreateCityDto, CreateLocationDto } from "../dtos/location.dto";

export class LocationService {
  private locationRepository: Repository<Location>;
  private attributesRepository: Repository<LocationAttributes>;
  private categoryRepository: Repository<LocationCategory>;
  private categoryMappingRepository: Repository<LocationCategoryMapping>;
  private addressRepository: Repository<Address>;
  private cityRepository: Repository<City>;

  constructor(dataSource: DataSource) {
    this.locationRepository = dataSource.getRepository(Location);
    this.attributesRepository = dataSource.getRepository(LocationAttributes);
    this.categoryRepository = dataSource.getRepository(LocationCategory);
    this.categoryMappingRepository = dataSource.getRepository(
      LocationCategoryMapping
    );
    this.addressRepository = dataSource.getRepository(Address);
    this.cityRepository = dataSource.getRepository(City);
  }

  // Location CRUD Operations
  async createLocation(locationData: CreateLocationDto): Promise<Location> {
    const location = new Location();
    location.name = locationData.name;
    location.slug = this.generateSlug(locationData.name);
    location.description = locationData.description ?? "";
    location.plusCode = locationData.plusCode || "";
    location.location_order = locationData.location_order || 0;

    if (
      locationData.parent_location_id !== undefined &&
      locationData.parent_location_id !== null
    ) {
      const parentLocation = await this.locationRepository.findOne({
        where: { location_id: locationData.parent_location_id },
      });
      if (parentLocation) {
        location.parent = parentLocation;
      }
    }
    const savedLocation = await this.locationRepository.save(location);
    // Add attributes if provided
    if (locationData.attributes) {
      const attributesObj: Record<string, string> = Array.isArray(
        locationData.attributes
      )
        ? locationData.attributes.reduce((acc, attr) => {
            if (attr.attributeKey && attr.attributeValue !== undefined) {
              acc[attr.attributeKey] = attr.attributeValue;
            }
            return acc;
          }, {} as Record<string, string>)
        : locationData.attributes;
      await this.setLocationAttributes(
        savedLocation.location_id,
        attributesObj
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

  async createCity(cityData: CreateCityDto): Promise<City> {
    const location = await this.createLocation(cityData);

    const city = new City();
    city.name = cityData.name;
    city.country = cityData.country ?? "Pakistan";
    city.location = location;
    return await this.cityRepository.save(city);
  }

  async getCityById(cityId: number): Promise<City | null> {
    return await this.cityRepository.findOne({
      where: { city_id: cityId },
      relations: ["location"],
    });
  }

  // get all cities
  async getAllCities(): Promise<City[]> {
    return await this.cityRepository.find({
      relations: ["location"],
    });
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
    if (locationData.plusCode !== undefined)
      location.plusCode = locationData.plusCode;
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

  async createAddress({
    locationId,
    street_address,
    landmark,
    is_primary,
  }: {
    locationId: number;
    street_address: string;
    landmark: string;
    is_primary: boolean;
  }): Promise<Address> {
    const location = await this.getLocationById(locationId);
    if (!location) {
      throw new Error("Location not found");
    }
    const address = new Address();
    address.location = location;
    address.street_address = street_address;
    address.landmark = landmark;
    address.is_primary = is_primary;
    return await this.addressRepository.save(address);
  }

  async getCityByLocationId(locationId: number): Promise<string | null> {
    if (!locationId) {
      throw new Error("Location ID is required");
    }

    let currentLocation = await this.locationRepository.findOne({
      where: { location_id: locationId },
      relations: ["parent", "categoryMappings", "categoryMappings.category"],
    });

    while (currentLocation) {
      const hasCityCategory = currentLocation.categoryMappings?.some(
        (mapping) => mapping.category?.name?.toLowerCase() === "city"
      );

      if (hasCityCategory) {
        return currentLocation.name;
      }

      if (currentLocation.parent) {
        currentLocation = await this.locationRepository.findOne({
          where: { location_id: currentLocation.parent.location_id },
          relations: [
            "parent",
            "categoryMappings",
            "categoryMappings.category",
          ],
        });
      } else {
        currentLocation = null;
      }
    }

    return null;
  }

  // get all addresses by location ID
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
  // Utility Methods
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "") // Remove non-word chars
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/--+/g, "-") // Replace multiple - with single -
      .trim();
  }
  async getLocationHierarchy(location: Location): Promise<Location[]> {
    const hierarchy: Location[] = [];
    let current: Location | null = location;
    const visited = new Set<number>();

    while (current) {
      if (visited.has(current.location_id)) {
        // Detected a cycle, break to avoid infinite loop
        break;
      }
      visited.add(current.location_id);
      hierarchy.unshift(current); // insert at the beginning
      current = await this.locationRepository.findOne({
        where: { location_id: current.parent?.location_id },
        relations: ["parent"],
      });
    }

    return hierarchy; // [city, locality, ...]
  }
}
