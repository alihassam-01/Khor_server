import { AppDataSource } from "../../../config/ormconfig";
import { Property } from "../entity/property";
import { FindOptionsWhere, ILike, In } from "typeorm";
import { CreateProperty } from "../dtos/property.dto";
import { LocationService } from "./location.service";
// import { City } from "@entity/address";
import { LocationHelperService } from "./helper/location-helper.service";
import { ListingPriceService } from "./listingPrice.service";

export class PropertyService {
  private repo = AppDataSource.getRepository(Property);
  private locationService = new LocationService(AppDataSource);
  // private cityRepository = AppDataSource.getRepository(City);
  private locationHelper = new LocationHelperService();
  private listingPriceService = new ListingPriceService();
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
      where: { address: { address_id: In(addressIds) }, active: true },
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

    const enrichedProperties = await this.locationHelper.enrichPropertiesWithLocationData(
      properties
    );

    return enrichedProperties;
  }

  /**
   * Get property by ID
   */
  async findById(id: string) {
    const property = await this.repo.findOne({
      where: { id, active: true },
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
    if (!property) return null;
    const enrichedProperty = await this.locationHelper.enrichWithLocationData(
      property
    );
    return enrichedProperty;
  }
  /**
   * Get property by vendorID
   */
  async findByVendorId(vendorId: string) {
    return await this.repo.findOne({
      where: { vendor: { id: vendorId }, active: true },
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
    // enrich the properties with location data
    const properties = await this.repo.find({
      relations: [
        "vendor",
        "roomTypes",
        "vehicles",
        "tourPackages",
        "tourPackages.destinations",
        "tourPackages.destinations.city",
        "deals",
        "address",
        "address.location",
        "address.location.parent",
      ],
      where: { active: true },
    });
    const cityCache = new Map<number, any>();

    const enrichedProperties =
      await this.locationHelper.enrichPropertiesWithLocationData(properties);

    // Collect all tour packages from all properties
    const allTourPackages: any[] = [];
    enrichedProperties.forEach((property) => {
      if (property.tourPackages?.length > 0) {
        allTourPackages.push(...property.tourPackages);
      }
    });

    // Batch enrich tour packages
    if (allTourPackages.length > 0) {
      await this.locationHelper.enrichTourPackagesWithCitiesBatch(
        allTourPackages,
        cityCache
      );
    }

    return enrichedProperties;
  }

  /**
   * Find properties by vendor ID
   */
  async findByVendor(vendorId: string) {
    const properties = await this.repo.find({
      where: { vendor: { id: vendorId } },
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
    if (!properties) return null;
    if (!properties) return null;

    // Collect all IDs
    const roomTypeIds: string[] = [];
    const tourPackageIds: string[] = [];
    const vehicleIds: string[] = [];

    properties.forEach((property) => {
      property.roomTypes.forEach((rt) => roomTypeIds.push(rt.id));
      property.tourPackages.forEach((tp) => tourPackageIds.push(tp.id));
      property.vehicles.forEach((v) => vehicleIds.push(v.id));
    });

    // Batch fetch listing prices
    const [roomPrices, tourPrices, vehiclePrices] = await Promise.all([
      roomTypeIds.length > 0
        ? this.listingPriceService.findByIdAndType(roomTypeIds, "room")
        : [],
      tourPackageIds.length > 0
        ? this.listingPriceService.findByIdAndType(tourPackageIds, "tourPackage")
        : [],
      vehicleIds.length > 0
        ? this.listingPriceService.findByIdAndType(vehicleIds, "vehicle")
        : [],
    ]);

    // Create maps for quick lookup
    const createPriceMap = (prices: any) => {
      const map = new Map<string, any>();
      if (Array.isArray(prices)) {
        prices.forEach((p) => map.set(p.entity_id, p));
      }
      return map;
    };

    const roomPriceMap = createPriceMap(roomPrices);
    const tourPriceMap = createPriceMap(tourPrices);
    const vehiclePriceMap = createPriceMap(vehiclePrices);

    // Assign prices back to entities
    for (const property of properties) {
      property.roomTypes.forEach((roomType) => {
        const price = roomPriceMap.get(roomType.id);
        if (price) {
          roomType.base_price = price.base_price;
        }
      });

      property.tourPackages.forEach((tourPackage) => {
        const price = tourPriceMap.get(tourPackage.id);
        if (price) {
          tourPackage.price_per_person = price.base_price;
        }
      });

      property.vehicles.forEach((vehicle) => {
        const price = vehiclePriceMap.get(vehicle.id);
        if (price) {
          vehicle.daily_rate = price.base_price;
        }
      });
    }
    const enrichedProperties = await Promise.all(
      properties.map((property) =>
        this.locationHelper.enrichWithLocationData(property)
      )
    );
    return enrichedProperties;
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
    const properties = await this.repo.find({
      where,
      relations: ["vendor",
        "roomTypes",
        "vehicles",
        "tourPackages",
        "tourPackages.destinations",
        "tourPackages.destinations.city",
        "deals",
        "address",
        "address.location",
        "address.location.parent",],
    });

    const cityCache = new Map<number, any>();

    const enrichedProperties =
      await this.locationHelper.enrichPropertiesWithLocationData(properties);

    // Collect all tour packages from all properties
    const allTourPackages: any[] = [];
    enrichedProperties.forEach((property) => {
      if (property.tourPackages?.length > 0) {
        allTourPackages.push(...property.tourPackages);
      }
    });

    // Batch enrich tour packages
    if (allTourPackages.length > 0) {
      await this.locationHelper.enrichTourPackagesWithCitiesBatch(
        allTourPackages,
        cityCache
      );
    }

    return enrichedProperties;
  }

  // async create(data: CreateProperty) {
  //   const property = await this._preparePropertyData(data);
  //   return await this.repo.save(property);
  // }

  async update(id: string, updates: Partial<CreateProperty>) {
    console.log("Updating property:", id);
    const existingProperty = await this.repo.findOne({
      where: { id },
      relations: ["address", "address.location", "vendor"],
    });
    console.log("Existing property found:", existingProperty);
    if (!existingProperty) {
      throw new Error("Property not found");
    }

    const property = await this._preparePropertyData(updates, existingProperty);
    console.log("Prepared property data:", property);
    return await this.repo.save(property);
  }

  /**
   * Shared helper to prepare property entity for create or update
   */
  private async _preparePropertyData(
    data: Partial<CreateProperty>,
    existingProperty?: Property
  ): Promise<Property> {
    let locationId: number;
    let addressId: number;

    if (existingProperty) {
      // Update location
      await this.locationService.updateLocation(
        existingProperty.address.location.location_id,
        {
          name: data.name ?? existingProperty.name,
          description: data.description ?? existingProperty.description,
          parent_location_id: data.localityId
            ? (data.localityId as unknown as number)
            : existingProperty.address.location.parent.location_id,
          plusCode: data.plusCode ?? existingProperty.address.location.plusCode,
        }
      );
      locationId = existingProperty.address.location.location_id;

      // Update address
      await this.locationService.updateAddress(
        existingProperty.address.address_id,
        {
          location: existingProperty.address.location,
          street_address:
            data.streetAddress ?? existingProperty.address.street_address,
          landmark: data.landmark ?? existingProperty.address.landmark,
          is_primary: existingProperty.address.is_primary,
        }
      );
      addressId = existingProperty.address.address_id;
    } else {
      // Create location
      const location = await this.locationService.createLocation({
        name: data.name!,
        description: data.description!,
        parent_location_id: data.localityId as unknown as number,
        plusCode: data.plusCode,
      });
      locationId = location.location_id;

      // Create address
      const address = await this.locationService.createAddress({
        locationId,
        street_address: data.streetAddress || "",
        landmark: data.landmark || "",
        is_primary: false,
      });
      addressId = address.address_id;
    }

    // Create or update property object
    const property = this.repo.create({
      ...(existingProperty ?? {}),
      name: data.name ?? existingProperty?.name,
      description: data.description ?? existingProperty?.description,
      vendor: { id: data.vendorId ?? existingProperty?.vendor?.id },
      type:
        (data.type as "hotel" | "car_rental" | "tour") ??
        existingProperty?.type,
      amenities: data.amenities ?? existingProperty?.amenities,
      images: data.images ?? existingProperty?.images,
      active: data.isActive ?? existingProperty?.active,
      address: { address_id: addressId },
    });

    return property;
  }

  /**
   * Soft delete (set active = false)
   */
  async deactivate(id: string) {
    const property = await this.repo.findOne({ where: { id } });
    if (!property) throw new Error("Property not found");
    const newActiveState = !property.active;
    await this.repo.update(id, { active: newActiveState });
    return { success: true, active: newActiveState };
  }

  /**
   * Permanently delete a property
   */
  async delete(id: string) {
    await this.repo.delete(id);
    return { success: true };
  }
}
