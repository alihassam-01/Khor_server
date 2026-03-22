import { AppDataSource } from "@config/ormconfig";
import { LocationService } from "@modules/user/service";
import { Location } from "@modules/user/entity/location";
import { LocationType } from "@modules/user/entity/ENUM/enum";

export class LocationHelperService {
  private locationService: LocationService;

  constructor() {
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
    const city = this.findCityInHierarchy(hierarchy);
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
        if (cachedCity && !cities.some((c) => c.location_id === cachedCity.location_id)) {
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
        if (!cities.some((c) => c.location_id === city.location_id)) {
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
        const { city, locality } = await this.getCityAndLocality(
          article.location_id
        );
        return { ...article, city, locality };
      })
    );
  }

  /**
   * Batch enriches properties with location hierarchy data (city and locality)
   * @param properties The list of properties to enrich
   * @returns The enriched properties with city and locality information
   */
  public async enrichPropertiesWithLocationData<
    T extends { address?: { location?: any } }
  >(properties: T[]): Promise<(T & { city: any; locality: any })[]> {
    // 1. Collect all unique location IDs
    const locationIds = new Set<number>();
    properties.forEach((property) => {
      if (property.address?.location) {
        locationIds.add(property.address.location.location_id);
      }
    });

    if (locationIds.size === 0) {
      return properties.map((p) => ({ ...p, city: null, locality: null }));
    }

    // 2. Fetch hierarchies for all locations
    // We can use a map to store locationId -> hierarchy
    const hierarchyMap = new Map<number, any[]>();

    // For now, we'll iterate and fetch hierarchies, but we can optimize this further
    // by fetching all ancestors in one go if we had a materialized path or closure table.
    // Given the current structure, we can at least parallelize or just accept this part
    // is still somewhat iterative but we can optimize the city/locality lookup.
    // A better approach for the current structure:
    // Fetch all locations in the set. Then fetch their parents recursively until root.
    // Build the hierarchy in memory.

    // Optimization: Fetch all involved locations and their parents up to root.
    // Since we don't have a simple "get all ancestors" query without recursive CTEs or iterative calls,
    // we will stick to parallel fetching of hierarchies for now, which is better than serial.
    // OR better: use Promise.all for the hierarchy fetching part if it's not too large.

    await Promise.all(
      Array.from(locationIds).map(async (id) => {
        // We need the location object to call getLocationHierarchy.
        // Assuming we can get it from the property or fetch it.
        // The property has address.location, which might be a partial object.
        // Let's ensure we have the full location object or fetch it.
        const property = properties.find(
          (p) => p.address?.location?.location_id === id
        );
        if (property?.address?.location) {
          const hierarchy = await this.locationService.getLocationHierarchy(
            property.address.location
          );
          hierarchyMap.set(id, hierarchy);
        }
      })
    );

    // 3. Collect all location IDs from all hierarchies to fetch cities in one go
    const allLocationIdsInHierarchies = new Set<number>();
    hierarchyMap.forEach((hierarchy) => {
      hierarchy.forEach((node) =>
        allLocationIdsInHierarchies.add(node.location_id)
      );
    });


    // For each hierarchy, find the city node
    const cityMapByHierarchy = new Map<number, Location | null>();
    hierarchyMap.forEach((hierarchy, id) => {
      const cityNode = hierarchy.find((n: Location) => n.location_type === LocationType.CITY) || null;
      cityMapByHierarchy.set(id, cityNode);
    });

    // 5. Enrich properties using in-memory data
    return properties.map((property) => {
      if (!property.address?.location) {
        return { ...property, city: null, locality: null };
      }

      const locationId = property.address.location.location_id;
      const hierarchy = hierarchyMap.get(locationId) || [];

      const cityNode = cityMapByHierarchy.get(locationId) || null;
      const city = cityNode ? { ...cityNode, type: "city" } : null;

      let locality = null;
      if (city) {
        const cityIndex = hierarchy.findIndex(
          (node: Location) => node.location_id === cityNode?.location_id
        );
        if (cityIndex !== -1 && hierarchy[cityIndex + 1]) {
          locality = { ...hierarchy[cityIndex + 1], type: "locality" };
        }
      }

      return { ...property, city, locality };
    });
  }

  /**
   * Batch enriches tour packages with cities
   * @param tourPackages List of tour packages
   * @param cityCache Optional cache
   */
  public async enrichTourPackagesWithCitiesBatch<
    T extends { destinations?: any[] }
  >(
    tourPackages: T[],
    cityCache: Map<number, any> = new Map()
  ): Promise<(T & { cities: any[] })[]> {
    // 1. Collect all unique destination location IDs
    const allDestinationIds = new Set<number>();
    tourPackages.forEach((pkg) => {
      pkg.destinations?.forEach((dest) => {
        if (!cityCache.has(dest.location_id)) {
          allDestinationIds.add(dest.location_id);
        }
      });
    });

    if (allDestinationIds.size > 0) {
      // 2. Fetch hierarchies for all uncached destinations
      // We need to fetch the location objects first to get hierarchies
      const locations = await this.locationService.getLocationsByIds(
        Array.from(allDestinationIds)
      );

      const hierarchyMap = new Map<number, any[]>();
      await Promise.all(
        locations.map(async (loc: Location) => {
          const hierarchy = await this.locationService.getLocationHierarchy(loc);
          hierarchyMap.set(loc.location_id, hierarchy);
        })
      );

      // 3. Collect all IDs in hierarchies to fetch cities
      const allHierarchyIds = new Set<number>();
      hierarchyMap.forEach((h) =>
        h.forEach((node) => allHierarchyIds.add(node.location_id))
      );

      // 4. Find cities using location_type
      const cityMapBatch = new Map<number, Location | null>();
      hierarchyMap.forEach((hierarchy, locationId) => {
        const cityNode = hierarchy.find((n: Location) => n.location_type === LocationType.CITY) || null;
        cityMapBatch.set(locationId, cityNode);
      });

      // 5. Update cache
      hierarchyMap.forEach((_hierarchy, locationId) => {
        const cityNode = cityMapBatch.get(locationId) || null;
        cityCache.set(locationId, cityNode ? { ...cityNode, type: "city" } : null);
      });
    }

    // 6. Map results
    return tourPackages.map((pkg) => {
      const cities: any[] = [];
      if (pkg.destinations) {
        pkg.destinations.forEach((dest) => {
          const city = cityCache.get(dest.location_id);
          if (city && !cities.some((c) => c.city_id === city.city_id)) {
            cities.push(city);
          }
        });
      }
      return { ...pkg, cities };
    });
  }

  /**
   * Finds the city in a location hierarchy
   * @param hierarchy The location hierarchy array
   * @returns City information if found, otherwise null
   */
  /**
   * Finds the city in a location hierarchy using location_type
   */
  private findCityInHierarchy(hierarchy: Location[]): Location | null {
    const cityNode = hierarchy.find((node) => node.location_type === LocationType.CITY);
    return cityNode ? { ...cityNode, type: "city" } as any : null;
  }

  /**
   * Finds the locality in a location hierarchy
   * @param hierarchy The location hierarchy array
   * @param city The city object found in the hierarchy
   * @returns Locality information if found, otherwise null
   */
  private findLocalityInHierarchy(hierarchy: any[], city: any | null): any | null {
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
    const city = this.findCityInHierarchy(hierarchy);
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
    const city = this.findCityInHierarchy(hierarchy);
    const locality = this.findLocalityInHierarchy(hierarchy, city);

    return { city, locality };
  }
}
