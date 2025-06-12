import { FastifyInstance } from "fastify";
import { HotelController } from "../controller/hotel.controller";
import { HotelService } from "../service/hotel.service";
import { LocationService } from "../service/location.service";
import { AppDataSource } from "@config/ormconfig";

export default async function hotelRoutes(fastify: FastifyInstance){
        const locationService = new LocationService(AppDataSource);
    const hotelService = new HotelService(locationService);
    const hotelController = new HotelController(hotelService);

    fastify.post("/room/room-type", hotelController.createRoomType.bind(hotelController))
    fastify.post("/hotel", hotelController.createHotel.bind(hotelController))
    fastify.post("/room/service-option", hotelController.createServiceOption.bind(hotelController))

}