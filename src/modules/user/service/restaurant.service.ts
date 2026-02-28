import { AppDataSource } from "../../../config/ormconfig";
import { Restaurant, RestaurantReview } from "../entity/ads";
import { Location } from "../entity/location";
import {
    IRestaurantDTO,
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
} from "../dtos/restaurant.dto";
import { SubscriptionType } from "../entity/ENUM/ad-payment.enum";

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
                facebook: restaurant.facebook,
                instagram: restaurant.instagram,
                website: restaurant.website,
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
            vendor_id: restaurant.vendor_id,
            subscription_type: restaurant.subscription_type,
            is_paid: restaurant.is_paid,
            is_featured: restaurant.is_featured,
            is_active: restaurant.is_active,
            location_id: restaurant.location_id,
            expires_at: restaurant.expires_at,
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
            restaurant.facebook = restaurantData.facebook || null;
            restaurant.instagram = restaurantData.instagram || null;
            restaurant.website = restaurantData.website || null;
            restaurant.description = restaurantData.description;
            restaurant.menu_images = restaurantData.menu_images || [];
            restaurant.location = location;
            restaurant.location_id = restaurantData.location_id;
            restaurant.is_active =
                restaurantData.is_active !== undefined
                    ? restaurantData.is_active
                    : true;
            restaurant.is_featured =
                restaurantData.is_featured !== undefined
                    ? restaurantData.is_featured
                    : false;

            // Handle subscription and vendor
            restaurant.vendor_id = restaurantData.vendor_id;

            // Default to FREE if not specified
            const subscriptionType = restaurantData.subscription_type || SubscriptionType.FREE;
            restaurant.subscription_type = subscriptionType;

            // Set is_paid based on subscription type
            restaurant.is_paid = subscriptionType !== SubscriptionType.FREE;

            // Calculate expiration date
            const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");
            const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
            const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey];

            const now = new Date();
            restaurant.expires_at = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

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

    async getAllRestaurants({ page = 1, limit = 10, searchQuery = "" }: { page?: number; limit?: number; searchQuery?: string } = {}): Promise<{ items: IRestaurantDTO[]; total: number; page: number; limit: number; }> {
        const skip = (page - 1) * limit;
        const queryBuilder = this.restaurantRepository.createQueryBuilder("restaurant")
            .leftJoinAndSelect("restaurant.location", "location")
            .leftJoinAndSelect("restaurant.detailed_reviews", "detailed_reviews")
            .where("restaurant.is_active = :isActive", { isActive: true })
            .orderBy("restaurant.created_at", "DESC");

        if (searchQuery && searchQuery.trim() !== "") {
            queryBuilder.andWhere("(restaurant.name ILIKE :search OR restaurant.description ILIKE :search)", { search: `%${searchQuery}%` });
        }

        const [restaurants, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        return {
            items: restaurants.map((restaurant) => this.toRestaurantDTO(restaurant)),
            total,
            page,
            limit,
        };
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
        if (restaurantData.is_featured !== undefined)
            restaurant.is_featured = restaurantData.is_featured;
        if (restaurantData.facebook !== undefined)
            restaurant.facebook = restaurantData.facebook;
        if (restaurantData.instagram !== undefined)
            restaurant.instagram = restaurantData.instagram;
        if (restaurantData.website !== undefined)
            restaurant.website = restaurantData.website;
        if (restaurantData.vendor_id !== undefined)
            restaurant.vendor_id = restaurantData.vendor_id;
        if (restaurantData.subscription_type !== undefined)
            restaurant.subscription_type = restaurantData.subscription_type;

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

    // ========== ADMIN METHODS ==========

    async toggleAdStatus(id: string, isActive: boolean): Promise<IRestaurantDTO> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        restaurant.is_active = isActive;
        const updatedRestaurant = await this.restaurantRepository.save(restaurant);
        return this.toRestaurantDTO(updatedRestaurant);
    }

    async renewAd(
        id: string,
        subscriptionType: import("../entity/ENUM/ad-payment.enum").SubscriptionType
    ): Promise<IRestaurantDTO> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");

        // Map subscription type to constant key
        const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey];

        const now = new Date();
        const currentExpiry = restaurant.expires_at && restaurant.expires_at > now ? restaurant.expires_at : now;

        restaurant.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
        restaurant.subscription_type = subscriptionType;
        restaurant.is_paid = true;
        restaurant.is_active = true;

        const updatedRestaurant = await this.restaurantRepository.save(restaurant);
        return this.toRestaurantDTO(updatedRestaurant);
    }

    async getExpiredAds(): Promise<IRestaurantDTO[]> {
        const now = new Date();
        const restaurants = await this.restaurantRepository
            .createQueryBuilder("restaurant")
            .leftJoinAndSelect("restaurant.location", "location")
            .leftJoinAndSelect("restaurant.detailed_reviews", "detailed_reviews")
            .where("restaurant.expires_at < :now", { now })
            .orWhere("restaurant.expires_at IS NULL")
            .orderBy("restaurant.created_at", "DESC")
            .getMany();

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async getAdsByVendor(vendorId: string): Promise<IRestaurantDTO[]> {
        const restaurants = await this.restaurantRepository.find({
            where: { vendor_id: vendorId },
            relations: ["location", "detailed_reviews"],
            order: { created_at: "DESC" },
        });

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async setFeaturedStatus(id: string, isFeatured: boolean): Promise<IRestaurantDTO> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        restaurant.is_featured = isFeatured;
        const updatedRestaurant = await this.restaurantRepository.save(restaurant);
        return this.toRestaurantDTO(updatedRestaurant);
    }

    async getAllRestaurantsAdmin(): Promise<IRestaurantDTO[]> {
        const restaurants = await this.restaurantRepository.find({
            relations: ["location", "detailed_reviews"],
            order: { created_at: "DESC" },
        });

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async getFeaturedAds(locationId: string): Promise<IRestaurantDTO[]> {
        const restaurants = await this.restaurantRepository.find({
            where: { is_featured: true, is_active: true, location_id: Number(locationId) },
            relations: ["location", "detailed_reviews"],
            order: { created_at: "DESC" },
        });

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }

    async getPremiumAds(): Promise<IRestaurantDTO[]> {
        const { SubscriptionType } = await import("../entity/ENUM/ad-payment.enum");
        const restaurants = await this.restaurantRepository
            .createQueryBuilder("restaurant")
            .leftJoinAndSelect("restaurant.location", "location")
            .leftJoinAndSelect("restaurant.detailed_reviews", "detailed_reviews")
            .where("restaurant.is_paid = :isPaid", { isPaid: true })
            .andWhere("restaurant.subscription_type != :free", { free: SubscriptionType.FREE })
            .orderBy("restaurant.created_at", "DESC")
            .getMany();

        return restaurants.map((restaurant) => this.toRestaurantDTO(restaurant));
    }
}
