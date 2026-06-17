import { FastifyInstance } from "fastify";
import { LocationService } from "@modules/user/service/location.service";
import { LocationController } from "@modules/user/controller/location.controller";
import { AppDataSource } from "@config/ormconfig";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import {
  ICreateLocationCategoryDto,
  ICreateLocationDto,
  IUpdateLocationCategoryDto,
  IUpdateLocationDto,
} from "@modules/user/dtos";
import {
  ICategoryIdParams,
  ILocationIdParams,
  ISetLocationAttributesBody,
  ISetLocationCategoriesBody,
} from "@modules/user/types";

export default async function locationRoutes(fastify: FastifyInstance) {
  const locationService = new LocationService(AppDataSource);
  const locationController = new LocationController(locationService);
  const adminOnly = [authenticate, authorizeAdmin];

  // Location routes
  fastify.get("/locations", locationController.getAllLocations.bind(locationController));
  fastify.get("/locations/:id", locationController.getLocationById.bind(locationController));
  fastify.get("/locations/slug/:slug", locationController.getLocationBySlug.bind(locationController));
  fastify.post<{ Body: ICreateLocationDto }>("/locations", { preHandler: adminOnly }, locationController.createLocation.bind(locationController));
  fastify.put<{ Params: ILocationIdParams; Body: IUpdateLocationDto }>("/locations/:id", { preHandler: adminOnly }, locationController.updateLocation.bind(locationController));
  fastify.delete<{ Params: ILocationIdParams }>("/locations/:id", { preHandler: adminOnly }, locationController.deleteLocation.bind(locationController));
  fastify.get("/locations/children/:locationId", locationController.getLocationChildren.bind(locationController));

  // Category routes
  fastify.get("/locations/categories", locationController.getAllCategories.bind(locationController));
  fastify.post<{ Body: ICreateLocationCategoryDto }>("/locations/category", { preHandler: adminOnly }, locationController.createCategory.bind(locationController));
  fastify.get("/locations/category/:id", locationController.getCategoryById.bind(locationController));
  fastify.put<{ Params: ICategoryIdParams; Body: IUpdateLocationCategoryDto }>("/locations/category/:id", { preHandler: adminOnly }, locationController.updateCategory.bind(locationController));
  fastify.delete<{ Params: ICategoryIdParams }>("/locations/category/:id", { preHandler: adminOnly }, locationController.deleteCategory.bind(locationController));
  fastify.get("/locations/category/slug/:slug", locationController.getCategoryBySlug.bind(locationController));
  fastify.get("/locations/by-category/:categoryname", locationController.getCategoryByName.bind(locationController));
  // Mapping routes
  fastify.post<{ Body: ISetLocationAttributesBody }>("/locations/map-attributes", { preHandler: adminOnly }, locationController.setLocationAttributes.bind(locationController));
  fastify.post<{ Body: ISetLocationCategoriesBody }>("/locations/map-categories", { preHandler: adminOnly }, locationController.setLocationCategories.bind(locationController));

  // city / type routes
  fastify.get("/locations/cities", locationController.getAllCities.bind(locationController));
  fastify.get("/locations/by-type/:type", locationController.getLocationsByType.bind(locationController));
}
