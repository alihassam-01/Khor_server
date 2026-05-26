import { FastifyInstance } from "fastify";
import { RestaurantController } from "@modules/user/controller/restaurant.controller";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { 
    IRestaurantIdParams, 
    IGetAllRestaurantsQuery, 
    IToggleRestaurantAdStatusBody, 
    IRenewRestaurantAdBody, 
    ISetRestaurantFeaturedStatusBody,
    IHotelLocationParams,
    IVendorIdParams
} from "@modules/user/types";
import { ICreateRestaurantDTO, IUpdateRestaurantDTO } from "@modules/user/dtos";

export async function restaurantRoutes(fastify: FastifyInstance) {
    const restaurantController = new RestaurantController();

    // Admin routes for restaurant management
    fastify.post<{ Body: ICreateRestaurantDTO | any }>(
        "/admin/restaurants",
        { preHandler: [authenticate, authorizeAdmin] },
        restaurantController.createRestaurant.bind(restaurantController)
    );
    
    fastify.get(
        "/admin/restaurants",
        { preHandler: [authenticate, authorizeAdmin] },
        restaurantController.getAllRestaurantsAdmin.bind(restaurantController)
    );
    
    fastify.get<{ Params: IRestaurantIdParams }>(
        "/admin/restaurants/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        restaurantController.getRestaurantById.bind(restaurantController)
    );
    
    fastify.put<{ Params: IRestaurantIdParams; Body: IUpdateRestaurantDTO | any }>(
        "/admin/restaurants/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        restaurantController.updateRestaurant.bind(restaurantController)
    );
    
    fastify.delete<{ Params: IRestaurantIdParams }>(
        "/admin/restaurants/:id",
        { preHandler: [authenticate, authorizeAdmin] },
        restaurantController.deleteRestaurant.bind(restaurantController)
    );

    // Admin routes for ad management
    fastify.post<{ Params: IRestaurantIdParams; Body: IToggleRestaurantAdStatusBody }>(
        "/admin/restaurants/:id/toggle-status", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        restaurantController.toggleAdStatus.bind(restaurantController)
    );
    
    fastify.post<{ Params: IRestaurantIdParams; Body: IRenewRestaurantAdBody }>(
        "/admin/restaurants/:id/renew", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        restaurantController.renewAd.bind(restaurantController)
    );
    
    fastify.post<{ Params: IRestaurantIdParams; Body: IRenewRestaurantAdBody }>(
        "/vendor/restaurants/:id/renew", 
        { preHandler: authenticate }, 
        restaurantController.renewAdByVendor.bind(restaurantController)
    );
    
    fastify.get(
        "/admin/restaurants/expired", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        restaurantController.getExpiredAds.bind(restaurantController)
    );
    
    fastify.get<{ Params: IHotelLocationParams }>(
        "/restaurants/featured/:locationId", 
        restaurantController.getFeaturedAds.bind(restaurantController)
    );
    
    fastify.get<{ Params: IHotelLocationParams }>(
        "/restaurants/premium/:locationId", 
        restaurantController.getPremiumAds.bind(restaurantController)
    );
    
    fastify.get<{ Params: IVendorIdParams }>(
        "/admin/restaurants/vendor/:vendorId", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        restaurantController.getAdsByVendor.bind(restaurantController)
    );
    
    fastify.post<{ Params: IRestaurantIdParams; Body: ISetRestaurantFeaturedStatusBody }>(
        "/admin/restaurants/:id/featured", 
        { preHandler: [authenticate, authorizeAdmin] }, 
        restaurantController.setFeaturedStatus.bind(restaurantController)
    );

    // Routes to get restaurants
    fastify.get<{ Querystring: IGetAllRestaurantsQuery }>(
        "/restaurants", 
        restaurantController.getAllRestaurants.bind(restaurantController)
    );
}
