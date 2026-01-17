import { AppDataSource } from "../../../config/ormconfig";
import { Restaurant, RestaurantReview } from "../entity/ads";
import { Location } from "../entity/location";
import {
    IRestaurantDTO,
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
} from "../dtos/restaurant.dto";

export class RestaurantService {
    private restaurantRepository = AppDataSource.getRepository(Restaurant);
    private locationRepository = AppDataSource.getRepository(Location);


    private toRestaurantDTO(restaurant: Restaurant): IRestaurantDTO {
        return {
            id: restaurant.id,
            name: restaurant.name,
            type: "restaurant",
            location: restaurant.location_name,
            price: Number(restaurant.price),
            rating: Number(restaurant.rating),
            reviews: restaurant.reviews,
            image: restaurant.image,
            links: {
                phone: restaurant.phone,
                whatsapp: restaurant.whatsapp,
            },
            description: restaurant.description,
            menu_images: restaurant.menu_images,
            detailed_reviews:
                restaurant.detailed_reviews?.map((review) => ({
                    user_name: review.user_name,
                    rating: Number(review.rating),
                    comment: review.comment,
                    date: review.date,
                })) || [],
        };
    }

    async createRestaurant(
        restaurantData: ICreateRestaurantDTO
    ): Promise<IRestaurantDTO> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Verify location exists
            const location = await this.locationRepository.findOne({
                where: { location_id: restaurantData.location_id },
            });

            if (!location) {
                throw new Error("Location not found");
            }

            // Create restaurant
            const restaurant = new Restaurant();
            restaurant.name = restaurantData.name;
            restaurant.location_name = restaurantData.location_name;
            restaurant.price = restaurantData.price;
            restaurant.rating = restaurantData.rating || 0;
            restaurant.reviews = restaurantData.reviews || 0;
            restaurant.image = restaurantData.image;
            restaurant.phone = restaurantData.phone || null;
            restaurant.whatsapp = restaurantData.whatsapp || null;
            restaurant.description = restaurantData.description;
            restaurant.menu_images = restaurantData.menu_images || [];
            restaurant.location = location;
            restaurant.location_id = restaurantData.location_id;
            restaurant.is_active =
                restaurantData.is_active !== undefined
                    ? restaurantData.is_active
                    : true;

            const savedRestaurant = await queryRunner.manager.save(restaurant);

            // Create reviews if provided
            if (
                restaurantData.detailed_reviews &&
                restaurantData.detailed_reviews.length > 0
            ) {
                const reviews = restaurantData.detailed_reviews.map((reviewData) => {
                    const review = new RestaurantReview();
                    review.user_name = reviewData.user_name;
                    review.rating = reviewData.rating;
                    review.comment = reviewData.comment;
                    review.date = reviewData.date;
                    review.restaurant = savedRestaurant;
                    review.restaurant_id = savedRestaurant.id;
                    return review;
                });
                await queryRunner.manager.save(reviews);
                savedRestaurant.detailed_reviews = reviews;
            }

            await queryRunner.commitTransaction();
            return this.toRestaurantDTO(savedRestaurant);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async getRestaurantById(id: string): Promise<IRestaurantDTO | null> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            return null;
        }

        return this.toRestaurantDTO(restaurant);
    }

    async getAllRestaurants(): Promise<IRestaurantDTO[]> {
        const restaurants = await this.restaurantRepository.find({
            relations: ["location", "detailed_reviews"],
            order: { created_at: "DESC" },
        });

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async getRestaurantsByLocation(locationId: number): Promise<IRestaurantDTO[]> {
        const restaurants = await this.restaurantRepository.find({
            where: { location_id: locationId, is_active: true },
            relations: ["location", "detailed_reviews"],
            order: { created_at: "DESC" },
        });

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async updateRestaurant(
        id: string,
        restaurantData: IUpdateRestaurantDTO
    ): Promise<IRestaurantDTO> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        // Update fields if provided
        if (restaurantData.name !== undefined)
            restaurant.name = restaurantData.name;
        if (restaurantData.location_name !== undefined)
            restaurant.location_name = restaurantData.location_name;
        if (restaurantData.price !== undefined)
            restaurant.price = restaurantData.price;
        if (restaurantData.rating !== undefined)
            restaurant.rating = restaurantData.rating;
        if (restaurantData.reviews !== undefined)
            restaurant.reviews = restaurantData.reviews;
        if (restaurantData.image !== undefined)
            restaurant.image = restaurantData.image;
        if (restaurantData.phone !== undefined)
            restaurant.phone = restaurantData.phone;
        if (restaurantData.whatsapp !== undefined)
            restaurant.whatsapp = restaurantData.whatsapp;
        if (restaurantData.description !== undefined)
            restaurant.description = restaurantData.description;
        if (restaurantData.menu_images !== undefined)
            restaurant.menu_images = restaurantData.menu_images;
        if (restaurantData.is_active !== undefined)
            restaurant.is_active = restaurantData.is_active;

        // Update location if changed
        if (
            restaurantData.location_id !== undefined &&
            restaurant.location_id !== restaurantData.location_id
        ) {
            const location = await this.locationRepository.findOne({
                where: { location_id: restaurantData.location_id },
            });
            if (location) {
                restaurant.location = location;
                restaurant.location_id = restaurantData.location_id;
            }
        }

        const updatedRestaurant = await this.restaurantRepository.save(restaurant);
        return this.toRestaurantDTO(updatedRestaurant);
    }

    async deleteRestaurant(id: string): Promise<void> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        await this.restaurantRepository.remove(restaurant);
    }
}
