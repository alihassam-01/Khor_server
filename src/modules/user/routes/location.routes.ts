import { FastifyInstance } from "fastify";
import { LocationService } from "../service/location.service";
import { LocationController } from "../controller/location.controller";
import { AppDataSource } from "../../../config/ormconfig";

export default async function locationRoutes(fastify: FastifyInstance) {
  const locationService = new LocationService(AppDataSource);
  const locationController = new LocationController(locationService);

  // Location routes
  fastify.get("/locations", locationController.getAllLocations.bind(locationController));
  fastify.get("/locations/:id", locationController.getLocationById.bind(locationController));
  fastify.get("/locations/slug/:slug", locationController.getLocationBySlug.bind(locationController));
  fastify.post("/locations", locationController.createLocation.bind(locationController));
  fastify.put("/locations/:id", locationController.updateLocation.bind(locationController));
  fastify.delete("/locations/:id", locationController.deleteLocation.bind(locationController));
  fastify.get("/locations/children/:locationId", locationController.getLocationChildren.bind(locationController));

  // Category routes
  fastify.get("/locations/categories", locationController.getAllCategories.bind(locationController));
  fastify.post("/locations/category", locationController.createCategory.bind(locationController));
  fastify.get("/locations/category/:id", locationController.getCategoryById.bind(locationController));
  fastify.get("/locations/category/slug/:slug", locationController.getCategoryBySlug.bind(locationController));
  fastify.get("/locations/by-category/:categoryname", locationController.getCategoryByName.bind(locationController));
  // Mapping routes
  fastify.post("/locations/map-attributes", locationController.setLocationAttributes.bind(locationController));
  fastify.post("/locations/map-categories", locationController.setLocationCategories.bind(locationController));


  // city routes
  fastify.post("/locations/city", locationController.createCity.bind(locationController));
  fastify.get("/locations/cities", locationController.getAllCities.bind(locationController));
  // fastify.get("/locations/cities/:id", locationController.getCityById.bind(locationController));
  // fastify.get("/locations/city/slug/:slug", locationController.getCityBySlug.bind(locationController));
  // fastify.put("/locations/cities/:id", locationController.updateCity.bind(locationController));
  // fastify.delete("/locations/cities/:id", locationController.deleteCity.bind(locationController));
  // fastify.get("/locations/cities/children/:cityId", locationController.getCityChildren.bind(locationController));
}
