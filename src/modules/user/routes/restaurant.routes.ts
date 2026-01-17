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
        restaurantController.getAllRestaurants.bind(restaurantController)
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
}
