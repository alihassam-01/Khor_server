import { FastifyInstance } from "fastify";
import { VehicleService } from "../service/vehicle.service";
import { VehicleController } from "../controller/vehicle.controller";
import { CreateVehicleDto, UpdateVehicleDto } from "../dtos/vehicle.dto";
import { authenticate } from "../../../middlewares/authenticate";

export async function vehicleRoutes(app: FastifyInstance) {
  const service = new VehicleService();
  const vehicleController = new VehicleController(service);

  app.post<{ Body: CreateVehicleDto }>(
    "/vehicles",
    { preHandler: authenticate },
    vehicleController.create.bind(vehicleController)
  );
  app.get("/vehicles", vehicleController.findAll.bind(vehicleController));
  app.get("/vehicles/:id", vehicleController.findById.bind(vehicleController));
  app.get(
    "/vehicles/property/:propertyId",
    vehicleController.findByProperty.bind(vehicleController)
  );
  app.put<{ Params: { id: string }; Body: UpdateVehicleDto }>(
    "/vehicles/:id",
    vehicleController.update.bind(vehicleController)
  );
  app.patch<{ Params: { id: string } }>(
    "/vehicles/:id/deactivate",
    { preHandler: authenticate },
    vehicleController.deactivate.bind(vehicleController)
  );
  app.delete<{ Params: { id: string } }>(
    "/vehicles/:id",
    { preHandler: authenticate },
    vehicleController.delete.bind(vehicleController)
  );
  app.get("/vehicles/search", vehicleController.search.bind(vehicleController));
}
