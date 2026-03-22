import { FastifyInstance } from "fastify";
import { RestaurantController } from "@modules/user/controller/restaurant.controller";
import { authenticate } from "@middlewares/authenticate";

export async function restaurantRoutes(fastify: FastifyInstance) {
    const restaurantController = new RestaurantController();

    // Admin routes for restaurant management
    fastify.post(
        "/admin/restaurants",
        { preHandler: authenticate },
        restaurantController.createRestaurant.bind(restaurantController)
    );
    fastify.get(
        "/admin/restaurants",
        { preHandler: authenticate },
        restaurantController.getAllRestaurantsAdmin.bind(restaurantController)
    );
    fastify.get(
        "/admin/restaurants/:id",
        { preHandler: authenticate },
        restaurantController.getRestaurantById.bind(restaurantController)
    );
    fastify.put(
        "/admin/restaurants/:id",
        { preHandler: authenticate },
        restaurantController.updateRestaurant.bind(restaurantController)
    );
    fastify.delete(
        "/admin/restaurants/:id",
        { preHandler: authenticate },
        restaurantController.deleteRestaurant.bind(restaurantController)
    );

    // Admin routes for ad management
    fastify.post("/admin/restaurants/:id/toggle-status", { preHandler: authenticate }, restaurantController.toggleAdStatus.bind(restaurantController));
    fastify.post("/admin/restaurants/:id/renew", { preHandler: authenticate }, restaurantController.renewAd.bind(restaurantController));
    fastify.get("/admin/restaurants/expired", { preHandler: authenticate }, restaurantController.getExpiredAds.bind(restaurantController));
    fastify.get("/restaurants/featured/:locationId", restaurantController.getFeaturedAds.bind(restaurantController));
    fastify.get("/restaurants/premium/:locationId", restaurantController.getPremiumAds.bind(restaurantController));
    fastify.get("/admin/restaurants/vendor/:vendorId", { preHandler: authenticate }, restaurantController.getAdsByVendor.bind(restaurantController));
    fastify.post("/admin/restaurants/:id/featured", { preHandler: authenticate }, restaurantController.setFeaturedStatus.bind(restaurantController));

    // Routes to get restaurants
    fastify.get("/restaurants", restaurantController.getAllRestaurants.bind(restaurantController));
}
