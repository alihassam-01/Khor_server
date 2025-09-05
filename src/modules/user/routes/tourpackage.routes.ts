import { FastifyInstance } from "fastify";
import { TourPackageService } from "../../user/service";
import { TourPackageController } from "../../user/controller";
import { TourPackageReceiveDTO } from "../dtos/tourpackage.dto";
import { authenticate } from "../../../middlewares/authenticate";

export async function tourPackageRoutes(app: FastifyInstance) {
  const service = new TourPackageService();
  const tourPackageController = new TourPackageController(service);

  app.post<{ Body: TourPackageReceiveDTO }>(
    "/tour-packages",
    { preHandler: authenticate },
    tourPackageController.create.bind(tourPackageController)
  );
  app.get(
    "/tour-packages",
    tourPackageController.findAll.bind(tourPackageController)
  );
  app.get(
    "/tour-packages/:id",
    tourPackageController.findById.bind(tourPackageController)
  );
  app.get(
    "/tour-packages/location/:locationId",
    tourPackageController.findBySingleLocationId.bind(tourPackageController)
  );
  app.get(
    "/tour-packages/property/:propertyId",
    tourPackageController.findByProperty.bind(tourPackageController)
  );
  app.put<{ Params: { id: string }; Body: TourPackageReceiveDTO }>(
    "/tour-packages/:id",
    tourPackageController.update.bind(tourPackageController)
  );
  app.patch<{ Params: { id: string } }>(
    "/tour-packages/:id/deactivate",
    { preHandler: authenticate },
    tourPackageController.deactivate.bind(tourPackageController)
  );
  app.delete<{ Params: { id: string } }>(
    "/tour-packages/:id",
    { preHandler: authenticate },
    tourPackageController.delete.bind(tourPackageController)
  );
  app.get(
    "/tour-packages/search",
    tourPackageController.search.bind(tourPackageController)
  );
}
