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

    async getAllRestaurants(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { page = 1, limit = 10, searchQuery = "" } = req.query as any;
            const pageNum = parseInt(page as string, 10) || 1;
            const limitNum = parseInt(limit as string, 10) || 10;
            const result = await this.restaurantService.getAllRestaurants({
                page: pageNum,
                limit: limitNum,
                searchQuery: searchQuery as string,
            });
            reply.send(result);
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

    // ========== ADMIN ENDPOINTS ==========

    async toggleAdStatus(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { is_active } = req.body as { is_active: boolean };
            const restaurant = await this.restaurantService.toggleAdStatus(id, is_active);
            reply.send(restaurant);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to toggle ad status" });
        }
    }

    async renewAd(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { subscription_type } = req.body as { subscription_type: import("../entity/ENUM/ad-payment.enum").SubscriptionType };
            const restaurant = await this.restaurantService.renewAd(id, subscription_type);
            reply.send(restaurant);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to renew ad" });
        }
    }

    async getExpiredAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurants = await this.restaurantService.getExpiredAds();
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch expired ads" });
        }
    }

    async getAdsByVendor(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { vendorId } = req.params as { vendorId: string };
            const restaurants = await this.restaurantService.getAdsByVendor(vendorId);
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch vendor ads" });
        }
    }

    async setFeaturedStatus(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { is_featured } = req.body as { is_featured: boolean };
            const restaurant = await this.restaurantService.setFeaturedStatus(id, is_featured);
            reply.send(restaurant);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to set featured status" });
        }
    }

    async getAllRestaurantsAdmin(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurants = await this.restaurantService.getAllRestaurantsAdmin();
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch restaurants" });
        }
    }

    async getFeaturedAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurants = await this.restaurantService.getFeaturedAds();
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch featured ads" });
        }
    }

    async getPremiumAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const restaurants = await this.restaurantService.getPremiumAds();
            reply.send(restaurants);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch premium ads" });
        }
    }
}
