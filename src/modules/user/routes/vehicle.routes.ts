import { FastifyInstance } from "fastify";
import { VehicleService } from "../service/vehicle.service";
import { VehicleController } from "../controller/vehicle.controller";

export async function vehicleRoutes(app: FastifyInstance) {
  const service = new VehicleService();
  const vehicleController = new VehicleController(service);

  app.post("/vehicles", vehicleController.create.bind(vehicleController));
  app.get("/vehicles", vehicleController.findAll.bind(vehicleController));
  app.get("/vehicles/:id", vehicleController.findById.bind(vehicleController));
  app.get("/vehicles/property/:propertyId", vehicleController.findByProperty.bind(vehicleController));
  app.put("/vehicles/:id", vehicleController.update.bind(vehicleController));
  app.patch("/vehicles/:id/deactivate", vehicleController.deactivate.bind(vehicleController));
  app.delete("/vehicles/:id", vehicleController.delete.bind(vehicleController));
  app.get("/vehicles/search", vehicleController.search.bind(vehicleController));
}
