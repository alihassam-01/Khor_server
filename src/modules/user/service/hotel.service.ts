import { AppDataSource } from "../../../config/ormconfig";
import { Hotel, HotelReview, HotelRoomType } from "../entity/ads";
import { Location } from "../entity/location";
import {
    IHotelDTO,
    ICreateHotelDTO,
    IUpdateHotelDTO,
} from "../dtos/hotel.dto";
import { SubscriptionType } from "../entity/ENUM/ad-payment.enum";

export class HotelService {
    private hotelRepository = AppDataSource.getRepository(Hotel);
    private locationRepository = AppDataSource.getRepository(Location);


    private toHotelDTO(hotel: Hotel): IHotelDTO {
        return {
            id: hotel.id,
            name: hotel.name,
            type: "hotel",
            rating: Number(hotel.rating),
            reviews: hotel.reviews,
            price: Number(hotel.price),
            location: hotel.location_name,
            image: hotel.image,
            description: hotel.description,
            amenities: hotel.amenities,
            logo: hotel.logo,
            verified: hotel.verified,
            links: {
                phone: hotel.phone,
                whatsapp: hotel.whatsapp,
                facebook: hotel.facebook,
                instagram: hotel.instagram,
                website: hotel.website,
            },
            detailed_reviews:
                hotel.detailed_reviews?.map((review) => ({
                    user_name: review.user_name,
                    rating: Number(review.rating),
                    comment: review.comment,
                    date: review.date,
                })) || [],
            roomTypes:
                hotel.room_types?.map((roomType) => ({
                    type: roomType.type,
                    price: Number(roomType.price),
                    amenities: roomType.amenities,
                    capacity: roomType.capacity,
                })) || [],
        };
    }

    async createHotel(hotelData: ICreateHotelDTO): Promise<IHotelDTO> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Verify location exists
            const location = await this.locationRepository.findOne({
                where: { location_id: hotelData.location_id },
            });

            if (!location) {
                throw new Error("Location not found");
            }

            // Create hotel
            const hotel = new Hotel();
            hotel.name = hotelData.name;
            hotel.rating = hotelData.rating || 0;
            hotel.reviews = hotelData.reviews || 0;
            hotel.price = hotelData.price;
            hotel.location_name = hotelData.location_name;
            hotel.image = hotelData.image;
            hotel.description = hotelData.description;
            hotel.amenities = hotelData.amenities;
            hotel.logo = hotelData.logo || null;
            hotel.verified = hotelData.verified || false;
            hotel.phone = hotelData.phone || null;
            hotel.whatsapp = hotelData.whatsapp || null;
            hotel.facebook = hotelData.facebook || null;
            hotel.instagram = hotelData.instagram || null;
            hotel.website = hotelData.website || null;
            hotel.location = location;
            hotel.location_id = hotelData.location_id;
            hotel.is_active = hotelData.is_active !== undefined ? hotelData.is_active : true;

            // Handle subscription and vendor
            hotel.vendor_id = hotelData.vendor_id;

            // Default to FREE if not specified
            const subscriptionType = hotelData.subscription_type || SubscriptionType.FREE;
            hotel.subscription_type = subscriptionType;

            // Set is_paid based on subscription type
            hotel.is_paid = subscriptionType !== SubscriptionType.FREE;

            // Calculate expiration date
            const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");
            const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
            const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey];

            const now = new Date();
            hotel.expires_at = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

            const savedHotel = await queryRunner.manager.save(hotel);

            // Create reviews if provided
            if (hotelData.detailed_reviews && hotelData.detailed_reviews.length > 0) {
                const reviews = hotelData.detailed_reviews.map((reviewData) => {
                    const review = new HotelReview();
                    review.user_name = reviewData.user_name;
                    review.rating = reviewData.rating;
                    review.comment = reviewData.comment;
                    review.date = reviewData.date;
                    review.hotel = savedHotel;
                    review.hotel_id = savedHotel.id;
                    return review;
                });
                await queryRunner.manager.save(reviews);
                savedHotel.detailed_reviews = reviews;
            }

            // Create room types if provided
            if (hotelData.roomTypes && hotelData.roomTypes.length > 0) {
                const roomTypes = hotelData.roomTypes.map((roomTypeData) => {
                    const roomType = new HotelRoomType();
                    roomType.type = roomTypeData.type;
                    roomType.price = roomTypeData.price;
                    roomType.amenities = roomTypeData.amenities;
                    roomType.capacity = roomTypeData.capacity;
                    roomType.hotel = savedHotel;
                    roomType.hotel_id = savedHotel.id;
                    return roomType;
                });
                await queryRunner.manager.save(roomTypes);
                savedHotel.room_types = roomTypes;
            }

            await queryRunner.commitTransaction();
            return this.toHotelDTO(savedHotel);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async getHotelById(id: string): Promise<IHotelDTO | null> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            return null;
        }

        return this.toHotelDTO(hotel);
    }

    async getAllHotels({ page = 1, limit = 10, searchQuery = "" }: { page?: number; limit?: number; searchQuery?: string }): Promise<{ items: IHotelDTO[]; total: number; page: number; limit: number; }> {
        const skip = (page - 1) * limit;
        const queryBuilder = this.hotelRepository.createQueryBuilder("hotel")
            .leftJoinAndSelect("hotel.location", "location")
            .leftJoinAndSelect("hotel.detailed_reviews", "detailed_reviews")
            .leftJoinAndSelect("hotel.room_types", "room_types")
            .where("hotel.is_active = :isActive", { isActive: true })
            .orderBy("hotel.created_at", "DESC");

        if (searchQuery && searchQuery.trim() !== "") {
            queryBuilder.andWhere("(hotel.name ILIKE :search OR hotel.description ILIKE :search)", { search: `%${searchQuery}%` });
        }

        const [hotels, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        return {
            items: hotels.map((hotel) => this.toHotelDTO(hotel)),
            total,
            page,
            limit,
        };
    }

    async getHotelsByLocation(locationId: number): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            where: { location_id: locationId, is_active: true },
            relations: ["location", "detailed_reviews", "room_types"],
            order: { created_at: "DESC" },
        });

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }

    async updateHotel(
        id: string,
        hotelData: IUpdateHotelDTO
    ): Promise<IHotelDTO> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        // Update fields if provided
        if (hotelData.name !== undefined) hotel.name = hotelData.name;
        if (hotelData.rating !== undefined) hotel.rating = hotelData.rating;
        if (hotelData.reviews !== undefined) hotel.reviews = hotelData.reviews;
        if (hotelData.price !== undefined) hotel.price = hotelData.price;
        if (hotelData.location_name !== undefined)
            hotel.location_name = hotelData.location_name;
        if (hotelData.image !== undefined) hotel.image = hotelData.image;
        if (hotelData.description !== undefined)
            hotel.description = hotelData.description;
        if (hotelData.amenities !== undefined)
            hotel.amenities = hotelData.amenities;
        if (hotelData.logo !== undefined) hotel.logo = hotelData.logo;
        if (hotelData.verified !== undefined) hotel.verified = hotelData.verified;
        if (hotelData.phone !== undefined) hotel.phone = hotelData.phone;
        if (hotelData.whatsapp !== undefined) hotel.whatsapp = hotelData.whatsapp;
        if (hotelData.is_active !== undefined)
            hotel.is_active = hotelData.is_active;

        // Update location if changed
        if (
            hotelData.location_id !== undefined &&
            hotel.location_id !== hotelData.location_id
        ) {
            const location = await this.locationRepository.findOne({
                where: { location_id: hotelData.location_id },
            });
            if (location) {
                hotel.location = location;
                hotel.location_id = hotelData.location_id;
            }
        }

        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async deleteHotel(id: string): Promise<void> {
        const hotel = await this.hotelRepository.findOne({ where: { id } });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        await this.hotelRepository.remove(hotel);
    }

    // ========== ADMIN METHODS ==========

    async toggleAdStatus(id: string, isActive: boolean): Promise<IHotelDTO> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        hotel.is_active = isActive;
        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async renewAd(
        id: string,
        subscriptionType: import("../entity/ENUM/ad-payment.enum").SubscriptionType
    ): Promise<IHotelDTO> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        const { SUBSCRIPTION_DURATION_DAYS } = await import("../constant/ad-subscription.constant");

        // Map subscription type to constant key
        const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey];

        const now = new Date();
        const currentExpiry = hotel.expires_at && hotel.expires_at > now ? hotel.expires_at : now;

        hotel.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
        hotel.subscription_type = subscriptionType;
        hotel.is_paid = true;
        hotel.is_active = true;

        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async getExpiredAds(): Promise<IHotelDTO[]> {
        const now = new Date();
        const hotels = await this.hotelRepository
            .createQueryBuilder("hotel")
            .leftJoinAndSelect("hotel.location", "location")
            .leftJoinAndSelect("hotel.detailed_reviews", "detailed_reviews")
            .leftJoinAndSelect("hotel.room_types", "room_types")
            .where("hotel.expires_at < :now", { now })
            .orWhere("hotel.expires_at IS NULL")
            .orderBy("hotel.created_at", "DESC")
            .getMany();

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }

    async getAdsByVendor(vendorId: string): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            where: { vendor_id: vendorId },
            relations: ["location", "detailed_reviews", "room_types"],
            order: { created_at: "DESC" },
        });

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }

    async setFeaturedStatus(id: string, isFeatured: boolean): Promise<IHotelDTO> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        hotel.is_featured = isFeatured;
        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async getAllHotelsAdmin(): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            relations: ["location", "detailed_reviews", "room_types"],
            order: { created_at: "DESC" },
        });

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }

    async getFeaturedAds(): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            where: { is_featured: true, is_active: true },
            relations: ["location", "detailed_reviews", "room_types"],
            order: { created_at: "DESC" },
        });

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }

    async getPremiumAds(): Promise<IHotelDTO[]> {
        const { SubscriptionType } = await import("../entity/ENUM/ad-payment.enum");
        const hotels = await this.hotelRepository
            .createQueryBuilder("hotel")
            .leftJoinAndSelect("hotel.location", "location")
            .leftJoinAndSelect("hotel.detailed_reviews", "detailed_reviews")
            .leftJoinAndSelect("hotel.room_types", "room_types")
            .where("hotel.is_paid = :isPaid", { isPaid: true })
            .andWhere("hotel.subscription_type != :free", { free: SubscriptionType.FREE })
            .orderBy("hotel.created_at", "DESC")
            .getMany();

        return hotels.map((hotel) => this.toHotelDTO(hotel));
    }
}
