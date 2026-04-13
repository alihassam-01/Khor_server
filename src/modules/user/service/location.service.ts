import { In, Repository, DataSource } from "typeorm";
import {
  Location,
  LocationAttributes,
  LocationCategoryMapping,
  LocationCategory,
} from "@modules/user/entity/location";
import { Address } from "@modules/user/entity/address";
import { 
    ICreateLocationDto, 
    ILocationDTO, 
    IUpdateLocationDto, 
    ICreateLocationCategoryDto,
    IUpdateLocationCategoryDto,
    ILocationCategoryDTO
} from "@modules/user/dtos";
import { LocationType } from "@common/enums";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

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

  private toLocationDTO(location: Location): ILocationDTO {
      return {
          location_id: location.location_id,
          name: location.name,
          slug: location.slug,
          description: location.description || "",
          plusCode: location.plusCode || "",
          location_order: location.location_order || 0,
          location_type: location.location_type,
          parent_id: location.parent?.location_id || null,
          parent: location.parent ? {
              location_id: location.parent.location_id,
              name: location.parent.name,
              location_type: location.parent.location_type
          } : null,
          attributes: location.attributes?.map(attr => ({
              attributeKey: attr.attributeKey,
              attributeValue: attr.attributeValue
          })) || [],
          categories: location.categoryMappings?.map(m => ({
              categoryId: m.category.categoryId,
              name: m.category.name,
              slug: m.category.slug
          })) || []
      };
  }

  // Location CRUD Operations
  async createLocation(locationData: ICreateLocationDto): Promise<ILocationDTO> {
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
      let attributesObj: Record<string, string> = {};
      if (Array.isArray(locationData.attributes)) {
          attributesObj = locationData.attributes.reduce((acc, attr) => {
              if (attr.attributeKey && attr.attributeValue !== undefined) {
                  acc[attr.attributeKey] = attr.attributeValue;
              }
              return acc;
          }, {} as Record<string, string>);
      } else {
          attributesObj = locationData.attributes;
      }
      await this.setLocationAttributes(savedLocation.location_id, attributesObj);
    }

    if (locationData.categories) {
      await this.addLocationToCategories(savedLocation.location_id, locationData.categories);
    }

    const finalLocation = await this.locationRepository.findOne({
        where: { location_id: savedLocation.location_id },
        relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });

    return this.toLocationDTO(finalLocation!);
  }

  async getLocationById(locationId: number): Promise<ILocationDTO | null> {
    const location = await this.getRawLocationById(locationId);
    return location ? this.toLocationDTO(location) : null;
  }

  async getRawLocationById(locationId: number): Promise<Location | null> {
    return await this.locationRepository.findOne({
      where: { location_id: locationId },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
  }

  async getLocationBySlug(slug: string): Promise<ILocationDTO | null> {
    const location = await this.locationRepository.findOne({
      where: { slug },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
    return location ? this.toLocationDTO(location) : null;
  }

  async getLocationsByIds(ids: number[]): Promise<ILocationDTO[]> {
    const locations = await this.getRawLocationsByIds(ids);
    return locations.map(l => this.toLocationDTO(l));
  }

  async getRawLocationsByIds(ids: number[]): Promise<Location[]> {
    return await this.locationRepository.find({
      where: { location_id: In(ids) },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
  }

  async updateLocation(locationId: number, locationData: IUpdateLocationDto): Promise<ILocationDTO | null> {
    const location = await this.locationRepository.findOne({
        where: { location_id: locationId },
        relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
    if (!location) throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);

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
        location.parent = null as unknown as Location;
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

    const saved = await this.locationRepository.save(location);
    const final = await this.locationRepository.findOne({
        where: { location_id: saved.location_id },
        relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
    });
    return this.toLocationDTO(final!);
  }

  async deleteLocation(locationId: number): Promise<boolean> {
    const location = await this.locationRepository.findOne({ where: { location_id: locationId } });
    if (!location) throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
    await this.locationRepository.remove(location);
    return true;
  }

  async getAllLocations(): Promise<ILocationDTO[]> {
    const locations = await this.locationRepository.find({
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
      order: { location_order: "ASC" },
    });
    return locations.map(l => this.toLocationDTO(l));
  }

  /** Returns all locations with location_type = 'city' */
  async getAllCities(): Promise<ILocationDTO[]> {
    const locations = await this.locationRepository.find({
      where: { location_type: LocationType.CITY },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
      order: { location_order: "ASC" },
    });
    return locations.map(l => this.toLocationDTO(l));
  }

  /** Returns locations filtered by type */
  async getLocationsByType(type: LocationType): Promise<ILocationDTO[]> {
    const locations = await this.locationRepository.find({
      where: { location_type: type },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
      order: { location_order: "ASC" },
    });
    return locations.map(l => this.toLocationDTO(l));
  }

  /**
   * Walk up the parent chain to find the nearest ancestor (or self) with location_type = 'city'
   */
  async getCityByLocationId(locationId: number): Promise<string | null> {
    if (!locationId) throw new AppError("Location ID is required", 400, ErrorCodes.BAD_REQUEST);

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

  /**
   * Fetches the full hierarchy of a location from the location up to the root parent.
   */
  async getLocationHierarchy(location: Location | { location_id: number }): Promise<Location[]> {
    const hierarchy: Location[] = [];
    let currentId: number | undefined = 'location_id' in location ? location.location_id : (location as Location).location_id;

    const visited = new Set<number>();
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const loc = await this.locationRepository.findOne({
        where: { location_id: currentId },
        relations: ["parent"],
      });

      if (!loc) break;
      hierarchy.push(loc);

      if (loc.parent) {
          currentId = loc.parent.location_id;
      } else {
          break;
      }
    }

    return hierarchy;
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
    if (!attribute) throw new AppError(`Attribute with key ${key} not found for location ${locationId}`, 404, ErrorCodes.NOT_FOUND);
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
    if (!mapping) throw new AppError("Category mapping not found", 404, ErrorCodes.NOT_FOUND);
    await this.categoryMappingRepository.remove(mapping);
    return true;
  }

  async getLocationsByCategoryName(categoryName: string): Promise<ILocationDTO[]> {
    const locations = await this.locationRepository
      .createQueryBuilder("location")
      .leftJoinAndSelect("location.categoryMappings", "mapping")
      .leftJoinAndSelect("mapping.category", "category")
      .leftJoinAndSelect("location.attributes", "attributes")
      .leftJoinAndSelect("location.parent", "parent")
      .where("category.name = :name", { name: categoryName })
      .getMany();
    
    return locations.map(l => this.toLocationDTO(l));
  }

  async getLocationChildren(locationId: number): Promise<ILocationDTO[]> {
    const locations = await this.locationRepository.find({
      where: { parent: { location_id: locationId } },
      relations: ["attributes", "categoryMappings", "categoryMappings.category", "parent"],
      order: { location_order: "ASC" },
    });
    return locations.map(l => this.toLocationDTO(l));
  }

  async getAllDescendants(locationId: number): Promise<ILocationDTO[]> {
    const descendants: ILocationDTO[] = [];
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
  async createCategory(categoryData: ICreateLocationCategoryDto): Promise<LocationCategory> {
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

  async getAllCategories(): Promise<ILocationCategoryDTO[]> {
    const categories = await this.categoryRepository.find({
      relations: ["parentCategory"],
      order: { name: "ASC" },
    });
    
    // Fetch counts for all categories
    const counts = await this.getCategoriesWithArticleCount();
    
    return categories.map(cat => ({
      categoryId: cat.categoryId,
      name: cat.name,
      slug: cat.slug,
      articleCount: counts[cat.categoryId] || 0
    }));
  }

  async getCategoriesWithArticleCount(): Promise<Record<number, number>> {
    const rawCounts = await this.categoryRepository
      .createQueryBuilder("category")
      .select("category.categoryId", "categoryId")
      .addSelect("COUNT(DISTINCT article.article_id)", "count")
      .leftJoin("category.articleMappings", "articleMapping")
      .leftJoin("category.categoryMappings", "mapping")
      .leftJoin("mapping.location", "location")
      .leftJoin("article_locations", "al", "al.location_id = location.location_id")
      .leftJoin(
        "articles", 
        "article", 
        "(article.article_id = articleMapping.article_id OR article.article_id = al.article_id) AND article.published_at IS NOT NULL"
      )
      .groupBy("category.categoryId")
      .getRawMany();

    return rawCounts.reduce((acc, row) => {
      acc[Number(row.categoryId)] = Number(row.count);
      return acc;
    }, {} as Record<number, number>);
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

  async updateCategory(categoryId: number, data: IUpdateLocationCategoryDto): Promise<LocationCategory> {
    const category = await this.categoryRepository.findOne({ where: { categoryId } });
    if (!category) throw new AppError("Category not found", 404, ErrorCodes.NOT_FOUND);

    if (data.name) {
      category.name = data.name;
      if (!data.slug) {
        category.slug = this.generateSlug(data.name);
      }
    }
    
    if (data.slug) {
      category.slug = data.slug;
    }

    if (data.parentCategoryId !== undefined) {
      if (data.parentCategoryId === null) {
        category.parentCategory = null as any;
      } else {
        const parent = await this.categoryRepository.findOne({
          where: { categoryId: data.parentCategoryId },
        });
        if (parent) category.parentCategory = parent;
      }
    }

    return await this.categoryRepository.save(category);
  }

  async deleteCategory(categoryId: number): Promise<void> {
    const category = await this.categoryRepository.findOne({ where: { categoryId } });
    if (!category) throw new AppError("Category not found", 404, ErrorCodes.NOT_FOUND);
    await this.categoryRepository.remove(category);
  }

  async createAddress({ locationId, street_address, landmark, is_primary }: {
    locationId: number;
    street_address: string;
    landmark: string;
    is_primary: boolean;
  }): Promise<Address> {
    const location = await this.locationRepository.findOne({ where: { location_id: locationId } });
    if (!location) throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
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
    if (!address) throw new AppError("Address not found", 404, ErrorCodes.NOT_FOUND);
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

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-")
      .trim();
  }
}
