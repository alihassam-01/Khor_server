import { FastifyRequest, FastifyReply } from "fastify";
import { RoomTypeService } from "../../user/service";
import { RoomType } from "../entity/room";
import { CreateRoomTypeDto } from "../dtos/roomtype.dto";

export class RoomTypeController {
  constructor(private readonly roomTypeService: RoomTypeService) {}


  async createRoomType(
    req: FastifyRequest<{ Body: CreateRoomTypeDto }>,
    reply: FastifyReply
  ) {
    try {
      const {
        name,
        base_price,
        max_occupancy,
        total_rooms,
        description,
        propertyId,
        images,
        amenities,
        active,
        size_sqm,
      } = req.body;
      const roomType = await this.roomTypeService.create({
        name,
        base_price,
        max_occupancy,
        total_rooms,
        description,
        property: { id: propertyId } as any,
        images,
        amenities,
        active,
        size_sqm,
      });
      reply.send(roomType);
    } catch (error: any) {
      this.handleError(reply, error, "Error creating room type", "20001");
    }
  }

  async getAllRoomTypes(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const rooms = await this.roomTypeService.findAll();
      reply.send(rooms);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching room types", "20002");
    }
  }
  async getAllRoomTypesForVendor(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const rooms = await this.roomTypeService.findAllForVendor();
      reply.send(rooms);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching room types", "20002");
    }
  }

  async getRoomTypeById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const room = await this.roomTypeService.findById(req.params.id);
      if (!room) {
        return reply
          .code(404)
          .send({ message: "Room type not found", code: "20003" });
      }
      reply.send(room);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching room type", "20003");
    }
  }
  async getRoomTypeByIdForVendor(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const room = await this.roomTypeService.findByIdForVendor(req.params.id);
      if (!room) {
        return reply
          .code(404)
          .send({ message: "Room type not found", code: "20003" });
      }
      reply.send(room);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching room type", "20003");
    }
  }

  async getRoomTypesByProperty(
    req: FastifyRequest<{ Params: { propertyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const rooms = await this.roomTypeService.findByProperty(
        req.params.propertyId
      );
      reply.send(rooms);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error fetching room types by property",
        "20004"
      );
    }
  }
  async getRoomTypesByPropertyForVendor(
    req: FastifyRequest<{ Params: { propertyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const rooms = await this.roomTypeService.findByPropertyForVendor(
        req.params.propertyId
      );
      reply.send(rooms);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error fetching room types by property",
        "20004"
      );
    }
  }

  async updateRoomType(
    req: FastifyRequest<{ Params: { id: string }; Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const updated = await this.roomTypeService.update(
        req.params.id,
        req.body as Partial<RoomType>
      );
      reply.send(updated);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating room type", "20005");
    }
  }

  async deactivateRoomType(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.roomTypeService.deactivate(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deactivating room type", "20006");
    }
  }

  async deleteRoomType(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.roomTypeService.delete(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deleting room type", "20007");
    }
  }

  async searchRoomTypes(
    req: FastifyRequest<{ Querystring: { term: string } }>,
    reply: FastifyReply
  ) {
    try {
      const results = await this.roomTypeService.search(req.query.term);
      reply.send(results);
    } catch (error: any) {
      this.handleError(reply, error, "Error searching room types", "20008");
    }
  }
  async searchRoomTypesForVendor(
    req: FastifyRequest<{ Querystring: { term: string } }>,
    reply: FastifyReply
  ) {
    try {
      const results = await this.roomTypeService.searchForVendor(
        req.query.term
      );
      reply.send(results);
    } catch (error: any) {
      this.handleError(reply, error, "Error searching room types", "20008");
    }
  }

  private handleError(
    reply: FastifyReply,
    error: any,
    defaultMessage: string,
    code: string
  ) {
    let parsedError = { message: defaultMessage, code };
    try {
      parsedError = JSON.parse(error.message);
    } catch (_) {
      parsedError.message = error.message || defaultMessage;
    }
    reply.code(400).send(parsedError);
  }
}
