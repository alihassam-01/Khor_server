import { AppDataSource } from "@config/ormconfig";
import { LocationService } from "@modules/user/service/location.service";
import { Location } from "@modules/user/entity/location";
import { LocationType } from "@common/enums/location.enums";

export interface IEnrichedLocation {
  city: Location | null;
  locality: Location | null;
}

export interface IEnrichedTourPackage {
  cities: Location[];
}

export class LocationHelperService {
  private locationService: LocationService;

  constructor() {
    this.locationService = new LocationService(AppDataSource);
  }

  /**
   * Enriches an entity with location hierarchy data (city and locality)
   */
  public async enrichWithLocationData<
    T extends { address?: { location?: Location | { location_id: number } } }
  >(entity: T): Promise<T & IEnrichedLocation> {
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
    const city = this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy);

    return {
      ...entity,
      city,
      locality,
    };
  }

  public async enrichTourPackageWithCities<T extends { destinations?: Array<{ location_id: number }> }>(
    tourPackage: T,
    cityCache: Map<number, Location | null> = new Map()
  ): Promise<T & IEnrichedTourPackage> {
    if (!tourPackage.destinations || tourPackage.destinations.length === 0) {
      return {
        ...tourPackage,
        cities: [],
      };
    }
    const cities: Location[] = [];

    for (const destination of tourPackage.destinations) {
      const locationId = destination.location_id;

      if (cityCache.has(locationId)) {
        const cachedCity = cityCache.get(locationId);
        if (cachedCity && !cities.some((c) => c.location_id === cachedCity.location_id)) {
          cities.push(cachedCity);
        }
        continue;
      }

      const hierarchy = await this.locationService.getLocationHierarchy(
        destination
      );

      const city = this.findCityInHierarchy(hierarchy);
      if (city) {
        cityCache.set(locationId, city);
        if (!cities.some((c) => c.location_id === city.location_id)) {
          cities.push(city);
        }
      } else {
        cityCache.set(locationId, null);
      }
    }

    return {
      ...tourPackage,
      cities,
    };
  }

  /**
   * Enrich articles with city and locality based on their location_id
   */
  public async enrichArticlesWithCities<T extends { locations?: Location[] | any[] }>(articles: T[]): Promise<(T & IEnrichedLocation)[]> {
    return Promise.all(
      articles.map(async (article) => {
        const locations = article.locations || [];
        const locationId = locations.length > 0 ? (locations[0].location_id || locations[0]) : null;

        if (!locationId) {
          return { ...article, city: null, locality: null };
        }
        const { city, locality } = await this.getCityAndLocality(
          Number(locationId)
        );
        return { ...article, city, locality };
      })
    );
  }

  /**
   * Batch enriches properties with location hierarchy data (city and locality)
   */
  public async enrichPropertiesWithLocationData<
    T extends { address?: { location?: Location | { location_id: number } } }
  >(properties: T[]): Promise<(T & IEnrichedLocation)[]> {
    const locationIds = new Set<number>();
    properties.forEach((property) => {
      const loc = property.address?.location;
      if (loc) {
        const id = 'location_id' in loc ? loc.location_id : (loc as any).location_id;
        locationIds.add(id);
      }
    });

    if (locationIds.size === 0) {
      return properties.map((p) => ({ ...p, city: null, locality: null } as T & IEnrichedLocation));
    }

    const hierarchyMap: Map<number, Location[]> = new Map<number, Location[]>();

    await Promise.all(
      Array.from(locationIds).map(async (id) => {
        const property = properties.find((p) => {
          const loc = p.address?.location;
          if (!loc) return false;
          const lid = 'location_id' in loc ? loc.location_id : (loc as any).location_id;
          return lid === id;
        });
        if (property?.address?.location) {
          const hierarchy = await this.locationService.getLocationHierarchy(
            property.address.location
          );
          hierarchyMap.set(id, hierarchy);
        }
      })
    );

    const cityMapByHierarchy: Map<number, Location | null> = new Map<number, Location | null>();
    hierarchyMap.forEach((hierarchy, id) => {
      const cityNode = hierarchy.find((n) => n.location_type === LocationType.CITY) || null;
      cityMapByHierarchy.set(id, cityNode);
    });

    return properties.map((property) => {
      const loc = property.address?.location;
      if (!loc) {
        return { ...property, city: null, locality: null } as T & IEnrichedLocation;
      }

      const locationId = 'location_id' in loc ? loc.location_id : (loc as any).location_id;
      const hierarchy = hierarchyMap.get(locationId) || [];
      const cityNode = cityMapByHierarchy.get(locationId) || null;
      
      const locality = hierarchy.find((node) => node.location_type === LocationType.LOCALITY) || null;
      return { ...property, city: cityNode, locality } as T & IEnrichedLocation;
    });
  }

  /**
   * Batch enriches tour packages with cities
   */
  public async enrichTourPackagesWithCitiesBatch<
    T extends { destinations?: Array<{ location_id: number }> }
  >(
    tourPackages: T[],
    cityCache: Map<number, Location | null> = new Map()
  ): Promise<(T & IEnrichedTourPackage)[]> {
    const allDestinationIds = new Set<number>();
    tourPackages.forEach((pkg) => {
      pkg.destinations?.forEach((dest) => {
        if (!cityCache.has(dest.location_id)) {
          allDestinationIds.add(dest.location_id);
        }
      });
    });

    if (allDestinationIds.size > 0) {
      const locations = await this.locationService.getRawLocationsByIds(
        Array.from(allDestinationIds)
      );

      const hierarchyMap: Map<number, Location[]> = new Map<number, Location[]>();
      await Promise.all(
        locations.map(async (loc) => {
          const hierarchy = await this.locationService.getLocationHierarchy(loc);
          hierarchyMap.set(loc.location_id, hierarchy);
        })
      );

      hierarchyMap.forEach((hierarchy, locationId) => {
        const cityNode = hierarchy.find((n) => n.location_type === LocationType.CITY) || null;
        cityCache.set(locationId, cityNode);
      });
    }

    return tourPackages.map((pkg) => {
      const cities: Location[] = [];
      if (pkg.destinations) {
        pkg.destinations.forEach((dest) => {
          const city = cityCache.get(dest.location_id);
          if (city && !cities.some((c) => c.location_id === city.location_id)) {
            cities.push(city);
          }
        });
      }
      return { ...pkg, cities };
    });
  }

  private findCityInHierarchy(hierarchy: Location[]): Location | null {
    return hierarchy.find((node) => node.location_type === LocationType.CITY) || null;
  }

  private findLocalityInHierarchy(hierarchy: Location[]): Location | null {
    return hierarchy.find((node) => node.location_type === LocationType.LOCALITY) || null;
  }

  public async getCompleteLocationHierarchy(locationId: number): Promise<{
    hierarchy: Location[];
    city: Location | null;
    locality: Location | null;
  }> {
    const location = await this.locationService.getRawLocationById(locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const hierarchy = await this.locationService.getLocationHierarchy(location);
    const city = this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy);

    return {
      hierarchy,
      city,
      locality,
    };
  }

  public async getCityAndLocality(locationId: number): Promise<{
    city: Location | null;
    locality: Location | null;
  }> {
    const location = await this.locationService.getRawLocationById(locationId);
    if (!location) {
      throw new Error("Location not found");
    }

    const hierarchy = await this.locationService.getLocationHierarchy(location);
    const city = this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy);

    return { city, locality };
  }
}
