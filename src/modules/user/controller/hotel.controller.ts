import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "../service/hotel.service";
import { ICreateHotelDTO, IUpdateHotelDTO } from "../dtos/hotel.dto";

export class HotelController {
    private hotelService = new HotelService();

    async createHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotelData = req.body as ICreateHotelDTO;
            const hotel = await this.hotelService.createHotel(hotelData);
            reply.code(201).send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to create hotel" });
        }
    }

    async getHotelById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const hotel = await this.hotelService.getHotelById(id);

            if (!hotel) {
                reply.code(404).send({ message: "Hotel not found" });
                return;
            }

            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch hotel" });
        }
    }

    async getAllHotels(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotels = await this.hotelService.getAllHotels();
            reply.send(hotels);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch hotels" });
        }
    }

    async updateHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const hotelData = req.body as IUpdateHotelDTO;
            const hotel = await this.hotelService.updateHotel(id, hotelData);
            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to update hotel" });
        }
    }

    async deleteHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            await this.hotelService.deleteHotel(id);
            reply.code(204).send();
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to delete hotel" });
        }
    }
}
