import { FastifyInstance } from "fastify";
import { HotelController } from "@modules/user/controller/hotel.controller";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { 
    IHotelIdParams, 
    IHotelLocationParams, 
    IVendorIdParams, 
    IToggleAdStatusBody, 
    IRenewAdBody, 
    ISetFeaturedStatusBody,
    IUpdateHotelSubscriptionBillingBody,
} from "@modules/user/types";
import { ICreateHotelDTO, IUpdateHotelDTO } from "@modules/user/dtos";
import { CONFIG } from "@config/config";

export async function hotelRoutes(fastify: FastifyInstance) {
    const hotelController = new HotelController();

    // Admin routes for hotel management - require authentication
    fastify.post<{ Body: ICreateHotelDTO | any }>(
        "/admin/hotels", 
        { preHandler: [authenticate, authorizeAdmin], bodyLimit: CONFIG.server.multipartBodyLimit },
        hotelController.createHotel.bind(hotelController)
    );
    
    fastify.get(
        "/admin/hotels", 
        { preHandler: [authenticate, authorizeAdmin], bodyLimit: CONFIG.server.multipartBodyLimit },
        hotelController.getAllHotelsAdmin.bind(hotelController)
    );
    
    fastify.get<{ Params: IHotelIdParams }>(
        "/admin/hotels/:id", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.getHotelById.bind(hotelController)
    );
    
    fastify.put<{ Params: IHotelIdParams; Body: IUpdateHotelDTO | any }>(
        "/admin/hotels/:id", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.updateHotel.bind(hotelController)
    );
    
    fastify.delete<{ Params: IHotelIdParams }>(
        "/admin/hotels/:id", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.deleteHotel.bind(hotelController)
    );

    // Admin routes for ad management - require authentication
    fastify.post<{ Params: IHotelIdParams; Body: IToggleAdStatusBody }>(
        "/admin/hotels/:id/toggle-status", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.toggleAdStatus.bind(hotelController)
    );
    
    fastify.post<{ Params: IHotelIdParams; Body: IRenewAdBody }>(
        "/admin/hotels/:id/renew", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.renewAd.bind(hotelController)
    );

    fastify.patch<{ Params: IHotelIdParams; Body: IUpdateHotelSubscriptionBillingBody }>(
        "/admin/hotels/:id/subscription-billing",
        { preHandler: [authenticate, authorizeAdmin] },
        hotelController.updateSubscriptionBilling.bind(hotelController)
    );

    fastify.post<{ Params: IHotelIdParams; Body: IRenewAdBody }>(
        "/vendor/hotels/:id/renew", 
        { preHandler: authenticate, bodyLimit: CONFIG.server.multipartBodyLimit },
        hotelController.renewAdByVendor.bind(hotelController)
    );

    fastify.put<{ Params: IHotelIdParams; Body: IUpdateHotelDTO | any }>(
        "/vendor/hotels/:id",
        { preHandler: authenticate },
        hotelController.updateHotelByVendor.bind(hotelController)
    );

    fastify.delete<{ Params: IHotelIdParams; Body: { image_url?: string } }>(
        "/vendor/hotels/:id/images",
        { preHandler: authenticate },
        hotelController.deleteVendorHotelImage.bind(hotelController)
    );

    fastify.get(
        "/vendor/hotels",
        { preHandler: authenticate },
        hotelController.getVendorHotels.bind(hotelController)
    );
    
    fastify.get(
        "/admin/hotels/expired", 
        { preHandler: [authenticate, authorizeAdmin] }, 
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
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.getAdsByVendor.bind(hotelController)
    );
    
    fastify.post<{ Params: IHotelIdParams; Body: ISetFeaturedStatusBody }>(
        "/admin/hotels/:id/featured", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        hotelController.setFeaturedStatus.bind(hotelController)
    );

    // Routes to get hotels
    fastify.get(
        "/hotels", 
        hotelController.getAllHotels.bind(hotelController)
    );

    fastify.get<{ Params: IHotelIdParams }>(
        "/hotels/:id",
        hotelController.getPublicHotelById.bind(hotelController)
    );
}
