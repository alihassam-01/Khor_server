import { FastifyInstance } from "fastify";
import { PropertyService } from "../service/property.service";
import { PropertyController } from "../controller/property.controller";
// import { AppDataSource } from "../../../config/ormconfig";

export default async function propertyRoutes(fastify: FastifyInstance) {
  const propertyService = new PropertyService();
  const propertyController = new PropertyController(propertyService);

  // fastify.get("/properties/vendor/:vendorId", propertyController.getPropertiesByVendor.bind(propertyController));
  // Location routes
//   fastify.get("/locations", locationController.getAllLocations.bind(locationController));
//   fastify.get("/locations/:id", locationController.getLocationById.bind(locationController));
//   fastify.get("/locations/slug/:slug", locationController.getLocationBySlug.bind(locationController));
//   fastify.post("/location", locationController.createLocation.bind(locationController));
//   fastify.put("/locations/:id", locationController.updateLocation.bind(locationController));
//   fastify.delete("/locations/:id", locationController.deleteLocation.bind(locationController));
//   fastify.get("/locations/children/:locationId", locationController.getLocationChildren.bind(locationController));

//   // Category routes
//   fastify.get("/locations/categories", locationController.getAllCategories.bind(locationController));
//   fastify.post("/locations/category", locationController.createCategory.bind(locationController));
//   fastify.get("/locations/category/:id", locationController.getCategoryById.bind(locationController));
//   fastify.get("/locations/category/slug/:slug", locationController.getCategoryBySlug.bind(locationController));
//   fastify.get("/locations/by-category/:categoryname", locationController.getCategoryByName.bind(locationController));
//   // Mapping routes
//   fastify.post("/locations/map-attributes", locationController.setLocationAttributes.bind(locationController));
//   fastify.post("/locations/map-categories", locationController.setLocationCategories.bind(locationController));
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
