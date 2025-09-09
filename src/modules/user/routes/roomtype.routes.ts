import { FastifyInstance } from "fastify";
import { RoomTypeService } from "../../user/service";
import { RoomTypeController } from "../../user/controller";
import { CreateRoomTypeDto } from "../dtos/roomtype.dto";
import { authenticate } from "../../../middlewares/authenticate";
import { RoomType } from "../entity";

export async function roomTypeRoutes(app: FastifyInstance) {
  const service = new RoomTypeService();
  const roomtypeController = new RoomTypeController(service);

  app.post<{ Body: CreateRoomTypeDto }>(
    "/room-types",
    { preHandler: authenticate },
    roomtypeController.createRoomType.bind(roomtypeController)
  );
  app.get(
    "/room-types",
    roomtypeController.getAllRoomTypes.bind(roomtypeController)
  );
  app.get(
    "/room-types/:id",
    roomtypeController.getRoomTypeById.bind(roomtypeController)
  );
  app.get(
    "/room-types/property/:propertyId",
    roomtypeController.getRoomTypesByProperty.bind(roomtypeController)
  );
  app.put<{ Params: { id: string }; Body: Partial<RoomType> }>(
    "/room-types/:id",
    { preHandler: authenticate },
    roomtypeController.updateRoomType.bind(roomtypeController)
  );
  app.patch<{ Params: { id: string } }>(
    "/room-types/:id/deactivate",
    { preHandler: authenticate },
    roomtypeController.deactivateRoomType.bind(roomtypeController)
  );
  app.delete<{ Params: { id: string } }>(
    "/room-types/:id",
    { preHandler: authenticate },
    roomtypeController.deleteRoomType.bind(roomtypeController)
  );
  app.get(
    "/room-types/search",
    roomtypeController.searchRoomTypes.bind(roomtypeController)
  );

  // for vendors:
  app.get(
    "/room-types/vendor",
    roomtypeController.getAllRoomTypesForVendor.bind(roomtypeController)
  );
  app.get(
    "/room-types/vendor/:id",
    roomtypeController.getRoomTypeByIdForVendor.bind(roomtypeController)
  );
  app.get(
    "/room-types/vendor/property/:propertyId",
    roomtypeController.getRoomTypesByPropertyForVendor.bind(roomtypeController)
  );
  app.get(
    "/room-types/vendor/search",
    roomtypeController.searchRoomTypesForVendor.bind(roomtypeController)
  );

  app.get(
    "/room-types/dates",
    roomtypeController.getAllRoomTypesByDates.bind(roomtypeController)
  );
}
