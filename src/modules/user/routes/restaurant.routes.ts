import { FastifyInstance } from "fastify";
import { RestaurantController } from "../controller/restaurant.controller";

export async function restaurantRoutes(fastify: FastifyInstance) {
    const restaurantController = new RestaurantController();

    // Admin routes for restaurant management
    fastify.post(
        "/admin/restaurants",
        restaurantController.createRestaurant.bind(restaurantController)
    );
    fastify.get(
        "/admin/restaurants",
        restaurantController.getAllRestaurantsAdmin.bind(restaurantController)
    );
    fastify.get(
        "/admin/restaurants/:id",
        restaurantController.getRestaurantById.bind(restaurantController)
    );
    fastify.put(
        "/admin/restaurants/:id",
        restaurantController.updateRestaurant.bind(restaurantController)
    );
    fastify.delete(
        "/admin/restaurants/:id",
        restaurantController.deleteRestaurant.bind(restaurantController)
    );

    // Admin routes for ad management
    fastify.post("/admin/restaurants/:id/toggle-status", restaurantController.toggleAdStatus.bind(restaurantController));
    fastify.post("/admin/restaurants/:id/renew", restaurantController.renewAd.bind(restaurantController));
    fastify.get("/admin/restaurants/expired", restaurantController.getExpiredAds.bind(restaurantController));
    fastify.get("/restaurants/featured/:locationId", restaurantController.getFeaturedAds.bind(restaurantController));
    fastify.get("/restaurants/premium/:locationId", restaurantController.getPremiumAds.bind(restaurantController));
    fastify.get("/admin/restaurants/vendor/:vendorId", restaurantController.getAdsByVendor.bind(restaurantController));
    fastify.post("/admin/restaurants/:id/featured", restaurantController.setFeaturedStatus.bind(restaurantController));

    // Routes to get restaurants
    fastify.get("/restaurants", restaurantController.getAllRestaurants.bind(restaurantController));
}
