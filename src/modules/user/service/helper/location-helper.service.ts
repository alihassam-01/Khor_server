import { AppDataSource } from "../../../../config/ormconfig";
import { City } from "../../entity/address";
import { Repository } from "typeorm";
import { LocationService } from "../../../user/service";

export class LocationHelperService {
  private cityRepository: Repository<City>;
  private locationService: LocationService;

  constructor() {
    this.cityRepository = AppDataSource.getRepository(City);
    this.locationService = new LocationService(AppDataSource);
  }

  /**
   * Enriches an entity with location hierarchy data (city and locality)
   * @param entity The entity containing an address with location
   * @returns The enriched entity with city and locality information
   */
  public async enrichWithLocationData<
    T extends { address?: { location?: any } }
  >(entity: T): Promise<T & { city: any; locality: any }> {
    if (!entity.address?.location) {
      return {
        ...entity,
        city: null,
        locality: null,
      };
    }

    const hierarchy = await this.locationService.getLocationHierarchy(
      entity.address.location
    );
    const city = await this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy, city);

    return {
      ...entity,
      city,
      locality,
    };
  }

  public async enrichTourPackageWithCities<T extends { destinations?: any[] }>(
    tourPackage: T,
    cityCache: Map<number, any> = new Map()
  ): Promise<T & { cities: any[] }> {
    if (!tourPackage.destinations || tourPackage.destinations.length === 0) {
      return {
        ...tourPackage,
        cities: [],
      };
    }
    const hierarchyMap: Record<number, any[]> = {};
    const cities: any[] = [];

    for (const destination of tourPackage.destinations) {
      const locationId = destination.location_id;

      // Skip if already cached
      if (cityCache.has(locationId)) {
        const cachedCity = cityCache.get(locationId);
        if (
          cachedCity &&
          !cities.some((c) => c.city_id === cachedCity.city_id)
        ) {
          cities.push(cachedCity);
        }
        continue;
      }

      // Fetch hierarchy and find city
      const hierarchy = await this.locationService.getLocationHierarchy(
        destination
      );
      hierarchyMap[locationId] = hierarchy;

      const city = await this.findCityInHierarchy(hierarchy);
      if (city) {
        cityCache.set(locationId, city);
        if (!cities.some((c) => c.city_id === city.city_id)) {
          cities.push(city);
        }
      } else {
        cityCache.set(locationId, null); // Cache null to avoid retrying
      }
    }

    return {
      ...tourPackage,
      cities,
    };
  }
  // Enrich articles with city and locality based on their location_id
  public async enrichArticlesWithCities(articles: any[]): Promise<any[]> {
    return Promise.all(
      articles.map(async (article) => {
        if (!article.location_id) {
          return { ...article, city: null, locality: null };
        }
        const { city, locality } = await this.getCityAndLocality(article.location_id);
        return { ...article, city, locality };
      })
    );
  }

  /**
   * Finds the city in a location hierarchy
   * @param hierarchy The location hierarchy array
   * @returns City information if found, otherwise null
   */
  private async findCityInHierarchy(hierarchy: any[]): Promise<any | null> {
    for (const node of hierarchy) {
      const foundCity = await this.cityRepository.findOne({
        where: { location_id: node.location_id },
      });
      if (foundCity) {
        return { ...foundCity, type: "city" };
      }
    }
    return null;
  }

  /**
   * Finds the locality in a location hierarchy
   * @param hierarchy The location hierarchy array
   * @param city The city object found in the hierarchy
   * @returns Locality information if found, otherwise null
   */
  private findLocalityInHierarchy(
    hierarchy: any[],
    city: any | null
  ): any | null {
    if (!city) return null;

    const cityIndex = hierarchy.findIndex(
      (node) => node.location_id === city.location_id
    );
    if (cityIndex !== -1 && hierarchy[cityIndex + 1]) {
      return { ...hierarchy[cityIndex + 1], type: "locality" };
    }
    return null;
  }

  /**
   * Gets complete location hierarchy with city and locality information
   * @param locationId The starting location ID
   * @returns Complete hierarchy information
   */
  public async getCompleteLocationHierarchy(locationId: number): Promise<{
    hierarchy: any[];
    city: any | null;
    locality: any | null;
  }> {
    const location = await this.locationService.getLocationById(locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const hierarchy = await this.locationService.getLocationHierarchy(location);
    const city = await this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy, city);

    return {
      hierarchy,
      city,
      locality,
    };
  }

  /**
   * Gets city and locality information for a location ID
   * @param locationId The location ID to check
   * @returns Object containing city and locality information
   */
  public async getCityAndLocality(locationId: number): Promise<{
    city: any | null;
    locality: any | null;
  }> {
    const location = await this.locationService.getLocationById(locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const hierarchy = await this.locationService.getLocationHierarchy(location);
    const city = await this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy, city);

    return { city, locality };
  }
}
