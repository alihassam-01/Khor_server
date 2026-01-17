import { FastifyInstance } from "fastify";
import { HotelController } from "../controller/hotel.controller";

export async function hotelRoutes(fastify: FastifyInstance) {
    const hotelController = new HotelController();

    // Admin routes for hotel management
    fastify.post("/admin/hotels", hotelController.createHotel.bind(hotelController));
    fastify.get("/admin/hotels", hotelController.getAllHotels.bind(hotelController));
    fastify.get("/admin/hotels/:id", hotelController.getHotelById.bind(hotelController));
    fastify.put("/admin/hotels/:id", hotelController.updateHotel.bind(hotelController));
    fastify.delete("/admin/hotels/:id", hotelController.deleteHotel.bind(hotelController));
}