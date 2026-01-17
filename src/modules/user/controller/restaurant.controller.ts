import { FastifyRequest, FastifyReply } from "fastify";
import { RestaurantService } from "../service/restaurant.service";
import {
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
} from "../dtos/restaurant.dto";

export class RestaurantController {
    private restaurantService = new RestaurantService();

    async createRestaurant(req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurantData = req.body as ICreateRestaurantDTO;
            const restaurant = await this.restaurantService.createRestaurant(
                restaurantData
            );
            reply.code(201).send(restaurant);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to create restaurant" });
        }
    }

    async getRestaurantById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const restaurant = await this.restaurantService.getRestaurantById(id);

            if (!restaurant) {
                reply.code(404).send({ message: "Restaurant not found" });
                return;
            }

            reply.send(restaurant);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch restaurant" });
        }
    }

    async getAllRestaurants(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurants = await this.restaurantService.getAllRestaurants();
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch restaurants" });
        }
    }

    async updateRestaurant(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const restaurantData = req.body as IUpdateRestaurantDTO;
            const restaurant = await this.restaurantService.updateRestaurant(
                id,
                restaurantData
            );
            reply.send(restaurant);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to update restaurant" });
        }
    }

    async deleteRestaurant(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            await this.restaurantService.deleteRestaurant(id);
            reply.code(204).send();
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to delete restaurant" });
        }
    }
}
