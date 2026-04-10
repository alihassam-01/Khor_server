import { FastifyInstance } from "fastify";
import { HotelController } from "@modules/user/controller/hotel.controller";
import { authenticate } from "@middlewares/authenticate";
import { 
    IHotelIdParams, 
    IHotelLocationParams, 
    IVendorIdParams, 
    IToggleAdStatusBody, 
    IRenewAdBody, 
    ISetFeaturedStatusBody 
} from "@modules/user/types";
import { ICreateHotelDTO, IUpdateHotelDTO } from "@modules/user/dtos";

export async function hotelRoutes(fastify: FastifyInstance) {
    const hotelController = new HotelController();

    // Admin routes for hotel management - require authentication
    fastify.post<{ Body: ICreateHotelDTO | any }>(
        "/admin/hotels", 
        { preHandler: authenticate }, 
        hotelController.createHotel.bind(hotelController)
    );
    
    fastify.get(
        "/admin/hotels", 
        { preHandler: authenticate }, 
        hotelController.getAllHotelsAdmin.bind(hotelController)
    );
    
    fastify.get<{ Params: IHotelIdParams }>(
        "/admin/hotels/:id", 
        { preHandler: authenticate }, 
        hotelController.getHotelById.bind(hotelController)
    );
    
    fastify.put<{ Params: IHotelIdParams; Body: IUpdateHotelDTO | any }>(
        "/admin/hotels/:id", 
        { preHandler: authenticate }, 
        hotelController.updateHotel.bind(hotelController)
    );
    
    fastify.delete<{ Params: IHotelIdParams }>(
        "/admin/hotels/:id", 
        { preHandler: authenticate }, 
        hotelController.deleteHotel.bind(hotelController)
    );

    // Admin routes for ad management - require authentication
    fastify.post<{ Params: IHotelIdParams; Body: IToggleAdStatusBody }>(
        "/admin/hotels/:id/toggle-status", 
        { preHandler: authenticate }, 
        hotelController.toggleAdStatus.bind(hotelController)
    );
    
    fastify.post<{ Params: IHotelIdParams; Body: IRenewAdBody }>(
        "/admin/hotels/:id/renew", 
        { preHandler: authenticate }, 
        hotelController.renewAd.bind(hotelController)
    );

    fastify.post<{ Params: IHotelIdParams; Body: IRenewAdBody }>(
        "/vendor/hotels/:id/renew", 
        { preHandler: authenticate }, 
        hotelController.renewAdByVendor.bind(hotelController)
    );
    
    fastify.get(
        "/admin/hotels/expired", 
        { preHandler: authenticate }, 
        hotelController.getExpiredAds.bind(hotelController)
    );
    
    fastify.get<{ Params: IHotelLocationParams }>(
        "/hotels/featured/:locationId", 
        hotelController.getFeaturedAds.bind(hotelController)
    );
    
    fastify.get(
        "/hotels/premium", 
        hotelController.getPremiumAds.bind(hotelController)
    );
    
    fastify.get<{ Params: IVendorIdParams }>(
        "/admin/hotels/vendor/:vendorId", 
        { preHandler: authenticate }, 
        hotelController.getAdsByVendor.bind(hotelController)
    );
    
    fastify.post<{ Params: IHotelIdParams; Body: ISetFeaturedStatusBody }>(
        "/admin/hotels/:id/featured", 
        { preHandler: authenticate }, 
        hotelController.setFeaturedStatus.bind(hotelController)
    );

    // Routes to get hotels
    fastify.get(
        "/hotels", 
        hotelController.getAllHotels.bind(hotelController)
    );
}
