import { FastifyInstance } from "fastify";
import { TourPackageService } from "@modules/user/service";
import { TourPackageController } from "@modules/user/controller";

export async function tourPackageRoutes(app: FastifyInstance) {
  const service = new TourPackageService();
  const tourPackageController = new TourPackageController(service);

  app.post("/tour-packages", tourPackageController.create.bind(tourPackageController));
  app.get("/tour-packages", tourPackageController.findAll.bind(tourPackageController));
  app.get("/tour-packages/:id", tourPackageController.findById.bind(tourPackageController));
  app.get("/tour-packages/location/:locationId", tourPackageController.findByLocationId.bind(tourPackageController));
  app.get("/tour-packages/property/:propertyId", tourPackageController.findByProperty.bind(tourPackageController));
  app.put("/tour-packages/:id", tourPackageController.update.bind(tourPackageController));
  app.patch("/tour-packages/:id/deactivate", tourPackageController.deactivate.bind(tourPackageController));
  app.delete("/tour-packages/:id", tourPackageController.delete.bind(tourPackageController));
  app.get("/tour-packages/search", tourPackageController.search.bind(tourPackageController));
}
