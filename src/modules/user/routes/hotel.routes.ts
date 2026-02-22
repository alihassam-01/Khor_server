import { FastifyInstance } from "fastify";
import { HotelController } from "../controller/hotel.controller";
import { authenticate } from "../../../middlewares/authenticate";

export async function hotelRoutes(fastify: FastifyInstance) {
    const hotelController = new HotelController();

    // Admin routes for hotel management - require authentication
    fastify.post("/admin/hotels", { 
        preHandler: authenticate 
    }, hotelController.createHotel.bind(hotelController));
    
    fastify.get("/admin/hotels", { 
        preHandler: authenticate 
    }, hotelController.getAllHotelsAdmin.bind(hotelController));
    
    fastify.get("/admin/hotels/:id", { 
        preHandler: authenticate 
    }, hotelController.getHotelById.bind(hotelController));
    
    fastify.put("/admin/hotels/:id", { 
        preHandler: authenticate 
    }, hotelController.updateHotel.bind(hotelController));
    
    fastify.delete("/admin/hotels/:id", { 
        preHandler: authenticate 
    }, hotelController.deleteHotel.bind(hotelController));

    // Admin routes for ad management - require authentication
    fastify.post("/admin/hotels/:id/toggle-status", { 
        preHandler: authenticate 
    }, hotelController.toggleAdStatus.bind(hotelController));
    
    fastify.post("/admin/hotels/:id/renew", { 
        preHandler: authenticate 
    }, hotelController.renewAd.bind(hotelController));
    
    fastify.get("/admin/hotels/expired", { 
        preHandler: authenticate 
    }, hotelController.getExpiredAds.bind(hotelController));
    
    fastify.get("/hotels/featured/:locationId", { 
        // preHandler: authenticate 
    }, hotelController.getFeaturedAds.bind(hotelController));
    
    fastify.get("/hotels/premium", { 
        // preHandler: authenticate 
    }, hotelController.getPremiumAds.bind(hotelController));
    
    fastify.get("/admin/hotels/vendor/:vendorId", { 
        preHandler: authenticate 
    }, hotelController.getAdsByVendor.bind(hotelController));
    
    fastify.post("/admin/hotels/:id/featured", { 
        preHandler: authenticate 
    }, hotelController.setFeaturedStatus.bind(hotelController));

    // Routes to get hotels
    fastify.get("/hotels", hotelController.getAllHotels.bind(hotelController));

}

