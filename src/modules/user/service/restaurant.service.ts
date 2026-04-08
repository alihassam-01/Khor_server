import { AppDataSource } from "@config/ormconfig";
import { Restaurant, RestaurantReview } from "@modules/user/entity/ads";
import { Vendor } from "@modules/user/entity/business/vendor-entity";
import { Location } from "@modules/user/entity/location";
import {
    IRestaurantDTO,
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
} from "../dtos/restaurant.dto";
import { SubscriptionType } from "@modules/user/entity/ENUM/ad-payment.enum";
import { R2ClientService } from "./r2client.service";
import { logError, logInfo } from "@lib/logger";

export class RestaurantService {
    private restaurantRepository = AppDataSource.getRepository(Restaurant);
    private locationRepository = AppDataSource.getRepository(Location);
    private vendorRepository = AppDataSource.getRepository(Vendor);

    // DB FK expects restaurants.vendor_id -> user.id. Accept either user id or legacy vendor profile id.
    private async resolveVendorUserId(candidateId?: string): Promise<string | undefined> {
        if (!candidateId) return undefined;

        const vendor = await this.vendorRepository.findOne({
            where: [{ id: candidateId }, { user: { id: candidateId } }],
            relations: ["user"],
        });

        if (!vendor) {
            logInfo("No vendor profile found for provided vendor_id, using value as user id", {
                providedId: candidateId,
            });
            return candidateId;
        }

        return vendor.user?.id;
    }


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
            images: restaurant.image ? [restaurant.image] : [],
            active: restaurant.is_active,
            links: {
                phone: restaurant.phone,
                whatsapp: restaurant.whatsapp,
                facebook: restaurant.facebook,
                instagram: restaurant.instagram,
                website: restaurant.website,
                map_link: restaurant.map_link,
            },
            latitude: restaurant.latitude ? Number(restaurant.latitude) : null,
            longitude: restaurant.longitude ? Number(restaurant.longitude) : null,
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

            restaurant.vendor_id = await this.resolveVendorUserId(restaurantData.vendor_id);

            restaurant.phone = restaurantData.phone || null;
            restaurant.whatsapp = restaurantData.whatsapp || null;
            restaurant.facebook = restaurantData.facebook || null;
            restaurant.instagram = restaurantData.instagram || null;
            restaurant.website = restaurantData.website || null;
            restaurant.map_link = restaurantData.map_link || null;
            restaurant.latitude = restaurantData.latitude ?? null;
            restaurant.longitude = restaurantData.longitude ?? null;
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

            // Preserve resolved user id for subscription/payment ownership.

            // Default to FREE if not specified
            const subscriptionType = restaurantData.subscription_type || SubscriptionType.FREE;
            restaurant.subscription_type = subscriptionType;

            if (subscriptionType === SubscriptionType.FREE && !restaurantData.is_featured) {
                restaurant.is_paid = false;
                restaurant.is_active = restaurantData.is_active !== undefined ? restaurantData.is_active : true;

                const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");
                const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
                const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;

                const now = new Date();
                restaurant.expires_at = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            } else {
                restaurant.is_paid = false;
                restaurant.is_active = false;
                restaurant.expires_at = null as any;
            }

            const savedRestaurant = await queryRunner.manager.save(restaurant);

            // Generate Payment Intent for non-free ads
            const vendorId = restaurant.vendor_id;
            if ((subscriptionType !== SubscriptionType.FREE || restaurant.is_featured) && vendorId) {
                const { SubscriptionPlanService } = await import("./subscription-plan.service");
                const planService = new SubscriptionPlanService();
                
                // Get plan by ID if provided, otherwise fallback to type
                let plan = null;
                if (restaurantData.plan_id) {
                    plan = await planService.getPlanById(restaurantData.plan_id);
                } else {
                    plan = await planService.getPlanByType(subscriptionType);
                }
                
                let totalAmount = plan ? plan.price : 0;
                
                if (restaurant.is_featured) {
                    const featuredPlan = await planService.getPlanByType("featured" as any);
                    totalAmount += featuredPlan ? featuredPlan.price : 1000;
                }
                
                if (totalAmount > 0) {
                    const { AdPayment } = await import("@modules/user/entity/ads/ad-payment.entity");
                    const { AdType, PaymentStatus, PaymentMethod } = await import("@modules/user/entity/ENUM/ad-payment.enum");
                    
                    const payment = new AdPayment();
                    payment.ad_id = savedRestaurant.id;
                    payment.ad_type = AdType.RESTAURANT;
                    payment.vendor_id = vendorId;
                    payment.amount = totalAmount;
                    payment.payment_method = PaymentMethod.BANK_TRANSFER;
                    payment.transaction_id = "PENDING_APPROVAL";
                    payment.notes = `Auto-generated payment intent for Restaurant: ${restaurantData.name}`;
                    payment.payment_status = PaymentStatus.PENDING;
                    
                    await queryRunner.manager.save(AdPayment, payment);
                }
            }

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
        const r2Client = new R2ClientService();
        const imagesToDelete: string[] = [];

        if (restaurantData.image !== undefined && restaurantData.image !== restaurant.image) {
            if (restaurant.image) imagesToDelete.push(restaurant.image);
            restaurant.image = restaurantData.image;
        }
        if (restaurantData.phone !== undefined)
            restaurant.phone = restaurantData.phone;
        if (restaurantData.whatsapp !== undefined)
            restaurant.whatsapp = restaurantData.whatsapp;
        if (restaurantData.description !== undefined)
            restaurant.description = restaurantData.description;
        if (restaurantData.menu_images !== undefined) {
            const oldImages = restaurant.menu_images || [];
            const newImages = restaurantData.menu_images || [];
            const removedMenuImages = oldImages.filter(img => !newImages.includes(img));
            imagesToDelete.push(...removedMenuImages);
            restaurant.menu_images = newImages;
        }
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
        if (restaurantData.map_link !== undefined)
            restaurant.map_link = restaurantData.map_link;
        if (restaurantData.latitude !== undefined)
            restaurant.latitude = restaurantData.latitude;
        if (restaurantData.longitude !== undefined)
            restaurant.longitude = restaurantData.longitude;
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

        if (imagesToDelete.length > 0) {
            r2Client.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Restaurant image cleanup on update'));
        }

        return this.toRestaurantDTO(updatedRestaurant);
    }

    async deleteRestaurant(id: string): Promise<void> {
        const restaurant = await this.restaurantRepository.findOne({
            where: { id },
        });

        if (!restaurant) {
            throw new Error("Restaurant not found");
        }

        const imagesToDelete: string[] = [];
        if (restaurant.image) imagesToDelete.push(restaurant.image);
        if (restaurant.menu_images && restaurant.menu_images.length > 0) {
            imagesToDelete.push(...restaurant.menu_images);
        }

        await this.restaurantRepository.remove(restaurant);

        if (imagesToDelete.length > 0) {
            const r2Client = new R2ClientService();
            r2Client.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Restaurant image cleanup on delete'));
        }
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

    async renewAdByVendor(
        id: string,
        vendorId: string,
        subscriptionType: import("../entity/ENUM/ad-payment.enum").SubscriptionType
    ): Promise<IRestaurantDTO> {
        const resolvedVendorUserId = await this.resolveVendorUserId(vendorId);
        if (!resolvedVendorUserId) {
            throw new Error("Unauthorized vendor");
        }

        const restaurant = await this.restaurantRepository.findOne({
            where: { id, vendor_id: resolvedVendorUserId },
            relations: ["location", "detailed_reviews"],
        });

        if (!restaurant) {
            throw new Error("Restaurant not found or access denied");
        }

        const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");
        const { SubscriptionPlanService } = await import("./subscription-plan.service");
        const { AdPayment } = await import("@modules/user/entity/ads/ad-payment.entity");
        const { AdType, PaymentStatus, PaymentMethod, SubscriptionType } = await import("@modules/user/entity/ENUM/ad-payment.enum");

        const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;

        const now = new Date();
        const currentExpiry = restaurant.expires_at && restaurant.expires_at > now ? restaurant.expires_at : now;

        restaurant.subscription_type = subscriptionType;
        restaurant.is_paid = false;

        const planService = new SubscriptionPlanService();
        
        // Get plan by ID if provided, otherwise fallback to type
        let plan = null;
        if (subscriptionType.length > 20) { // Checking if it looks like a UUID
            plan = await planService.getPlanById(subscriptionType as string);
        } else {
            plan = await planService.getPlanByType(subscriptionType as any);
        }
        
        const amount = plan ? Number(plan.price) : 0;

        if (subscriptionType === SubscriptionType.FREE || amount <= 0) {
            restaurant.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
            restaurant.is_active = true;
        } else {
            restaurant.is_active = false;
            const payment = new AdPayment();
            payment.ad_id = restaurant.id;
            payment.ad_type = AdType.RESTAURANT;
            payment.vendor_id = resolvedVendorUserId;
            payment.amount = amount;
            payment.payment_method = PaymentMethod.BANK_TRANSFER;
            payment.transaction_id = "PENDING_APPROVAL";
            payment.notes = `Renewal payment intent for Restaurant: ${restaurant.name}`;
            payment.payment_status = PaymentStatus.PENDING;
            await AppDataSource.getRepository(AdPayment).save(payment);
        }

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
        const resolvedVendorUserId = await this.resolveVendorUserId(vendorId);
        if (!resolvedVendorUserId) {
            return [];
        }

        const restaurants = await this.restaurantRepository.find({
            where: { vendor_id: resolvedVendorUserId },
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
