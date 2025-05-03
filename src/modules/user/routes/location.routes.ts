import { FastifyInstance } from "fastify";
import { LocationService } from "../service/location.service";
import { LocationController } from "../controller/location.controller";
import { AppDataSource } from "../../../config/ormconfig";

export default async function locationRoutes(fastify: FastifyInstance) {
  const locationService = new LocationService(AppDataSource);
  const locationController = new LocationController(locationService);

  fastify.get("/locations", locationController.getAllLocations.bind(locationController));
  fastify.get("/locations/:id", locationController.getLocationById.bind(locationController));
  fastify.post("/locations", locationController.createLocation.bind(locationController));
  fastify.put("/locations/:id", locationController.updateLocation.bind(locationController));
  fastify.delete("/locations/:id", locationController.deleteLocation.bind(locationController));
}
