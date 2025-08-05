import { FastifyInstance } from "fastify";
import { PropertyService } from "../service/property.service";
import { PropertyController } from "../controller/property.controller";
// import { AppDataSource } from "../../../config/ormconfig";

export default async function propertyRoutes(fastify: FastifyInstance) {
  const propertyService = new PropertyService();
  const propertyController = new PropertyController(propertyService);

fastify.post("/properties", propertyController.createProperty.bind(propertyController));
fastify.get("/properties", propertyController.getAllProperties.bind(propertyController));
fastify.get("/properties/:id", propertyController.getPropertyById.bind(propertyController));
fastify.get("/properties/vendor/:vendorId", propertyController.getPropertiesByVendor.bind(propertyController));
fastify.get("/properties/location/:locationId", propertyController.getPropertiesByLocationId.bind(propertyController));
fastify.put("/properties/:id", propertyController.updateProperty.bind(propertyController));
fastify.patch("/properties/:id/deactivate", propertyController.deactivateProperty.bind(propertyController));
fastify.delete("/properties/:id", propertyController.deleteProperty.bind(propertyController));
fastify.get("/properties/search", propertyController.searchProperties.bind(propertyController));

}
