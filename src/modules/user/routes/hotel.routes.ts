import { FastifyInstance } from "fastify";
import { HotelController } from "../controller/hotel.controller";

export async function hotelRoutes(fastify: FastifyInstance) {
    const hotelController = new HotelController();

    // Admin routes for hotel management
    fastify.post("/admin/hotels", hotelController.createHotel.bind(hotelController));
    fastify.get("/admin/hotels", hotelController.getAllHotelsAdmin.bind(hotelController));
    fastify.get("/admin/hotels/:id", hotelController.getHotelById.bind(hotelController));
    fastify.put("/admin/hotels/:id", hotelController.updateHotel.bind(hotelController));
    fastify.delete("/admin/hotels/:id", hotelController.deleteHotel.bind(hotelController));

    // Admin routes for ad management
    fastify.post("/admin/hotels/:id/toggle-status", hotelController.toggleAdStatus.bind(hotelController));
    fastify.post("/admin/hotels/:id/renew", hotelController.renewAd.bind(hotelController));
    fastify.get("/admin/hotels/expired", hotelController.getExpiredAds.bind(hotelController));
    fastify.get("/admin/hotels/featured", hotelController.getFeaturedAds.bind(hotelController));
    fastify.get("/admin/hotels/premium", hotelController.getPremiumAds.bind(hotelController));
    fastify.get("/admin/hotels/vendor/:vendorId", hotelController.getAdsByVendor.bind(hotelController));
    fastify.post("/admin/hotels/:id/featured", hotelController.setFeaturedStatus.bind(hotelController));

    // Routes to get hotels
    fastify.get("/hotels", hotelController.getAllHotels.bind(hotelController));

}

