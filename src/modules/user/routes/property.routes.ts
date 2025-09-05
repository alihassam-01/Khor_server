import { FastifyInstance } from "fastify";
import { PropertyService } from "../service/property.service";
import { PropertyController } from "../controller/property.controller";
import { authenticate } from "../../../middlewares/authenticate";
import { CreateProperty } from "../dtos/property.dto";
import { Property } from "../entity";
// import { AppDataSource } from "../../../config/ormconfig";

export default async function propertyRoutes(fastify: FastifyInstance) {
  const propertyService = new PropertyService();
  const propertyController = new PropertyController(propertyService);

  fastify.post<{ Body: CreateProperty }>(
    "/properties",
    { preHandler: authenticate },
    propertyController.createProperty.bind(propertyController)
  );
  fastify.get(
    "/properties",
    propertyController.getAllProperties.bind(propertyController)
  );
  fastify.get(
    "/properties/:id",
    propertyController.getPropertyById.bind(propertyController)
  );
  fastify.get<{ Params: { vendorId: string } }>(
    "/properties/vendor/:vendorId",
    { preHandler: authenticate },
    propertyController.getPropertiesByVendor.bind(propertyController)
  );
  fastify.get(
    "/properties/location/:locationId",
    propertyController.getPropertiesByLocationId.bind(propertyController)
  );
  fastify.put<{ Params: { id: string }; Body: Partial<Property> }>(
    "/properties/:id",
    { preHandler: authenticate },
    propertyController.updateProperty.bind(propertyController)
  );
  fastify.patch(
    "/properties/:id/deactivate",
    propertyController.deactivateProperty.bind(propertyController)
  );
  fastify.delete<{ Params: { id: string } }>(
    "/properties/:id",
    { preHandler: authenticate },
    propertyController.deleteProperty.bind(propertyController)
  );
  fastify.get(
    "/properties/search",
    propertyController.searchProperties.bind(propertyController)
  );
}
