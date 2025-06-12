import { FastifyReply, FastifyRequest } from "fastify";
import { HotelService } from "../service/hotel.service";

export class HotelController {
  constructor(private readonly hotelService: HotelService) {}

  async createHotel(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const {
        hotelName,
        locationId,
        vendorId,
        businessTypeId,
        markupFileLocation,
        street_address,
        landmark,
        is_primary,
      } = req.body as {
        hotelName: string,
    locationId: number,
    street_address: string,
    businessTypeId: number,
    landmark: string,
    vendorId: string,
    is_primary: boolean,
    markupFileLocation?: string
      };
      const hotel = await this.hotelService.createHotel(
        hotelName,
        locationId,
        street_address,
        businessTypeId,
        landmark,
        vendorId,
        is_primary,
        markupFileLocation
      );
      reply.code(201).send(hotel);
    } catch (error: any) {
      let parsedError = { message: "Error creating Hotel", code: "10003" };

      try {
        parsedError = JSON.parse(error.message);
      } catch (_) {
        parsedError.message = error.message;
      }

      reply.code(400).send(parsedError);
    }
  }

  async createRoomType(
    req: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const {
        name,
        basePrice,
        maxOccupancy,
        totalRooms,
        typeDescription,
        propertyId,
      } = req.body as {
        name: string;
        basePrice: number;
        maxOccupancy: number;
        totalRooms: number;
        typeDescription: string;
        propertyId: number;
      };
      const roomType = await this.hotelService.createRoomType(
        name,
        basePrice,
        maxOccupancy,
        totalRooms,
        typeDescription,
        propertyId
      );
      reply.code(201).send(roomType);
    } catch (error: any) {
      let parsedError = { message: "Error creating Room Type", code: "10004" };

      try {
        parsedError = JSON.parse(error.message);
      } catch (_) {
        parsedError.message = error.message;
      }

      reply.code(400).send(parsedError);
    }
  }
  async createServiceOption(
    req: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const { name, possibleValues, propertyType } = req.body as {
        name: string;
        possibleValues: string[];
        propertyType: string;
      };
      const serviceOption = await this.hotelService.createServiceOption(
        name,
        possibleValues,
        propertyType
      );
      reply.code(201).send(serviceOption);
    } catch (error: any) {
      let parsedError = {
        message: "Error creating Service Option",
        code: "10005",
      };

      try {
        parsedError = JSON.parse(error.message);
      } catch (_) {
        parsedError.message = error.message;
      }

      reply.code(400).send(parsedError);
    }
  }
}
