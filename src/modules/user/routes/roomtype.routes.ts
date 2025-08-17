import { FastifyInstance } from "fastify";
import { RoomTypeService } from "@modules/user/service";
import { RoomTypeController } from "@modules/user/controller";

export async function roomTypeRoutes(app: FastifyInstance) {
  const service = new RoomTypeService();
  const roomtypeController = new RoomTypeController(service);

  app.post("/room-types", roomtypeController.createRoomType.bind(roomtypeController));
  app.get("/room-types", roomtypeController.getAllRoomTypes.bind(roomtypeController));
  app.get("/room-types/:id", roomtypeController.getRoomTypeById.bind(roomtypeController));
  app.get("/room-types/property/:propertyId", roomtypeController.getRoomTypesByProperty.bind(roomtypeController));
  app.put("/room-types/:id", roomtypeController.updateRoomType.bind(roomtypeController));
  app.patch("/room-types/:id/deactivate", roomtypeController.deactivateRoomType.bind(roomtypeController));
  app.delete("/room-types/:id", roomtypeController.deleteRoomType.bind(roomtypeController));
  app.get("/room-types/search", roomtypeController.searchRoomTypes.bind(roomtypeController));

  // for vendors:
  app.get("/room-types/vendor", roomtypeController.getAllRoomTypesForVendor.bind(roomtypeController));
  app.get("/room-types/vendor/:id", roomtypeController.getRoomTypeByIdForVendor.bind(roomtypeController));
  app.get("/room-types/vendor/property/:propertyId", roomtypeController.getRoomTypesByPropertyForVendor.bind(roomtypeController));
  app.get("/room-types/vendor/search", roomtypeController.searchRoomTypesForVendor.bind(roomtypeController));
}
