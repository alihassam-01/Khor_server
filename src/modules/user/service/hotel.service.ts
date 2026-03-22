import { AppDataSource } from "@config/ormconfig";
import { Hotel, HotelReview, HotelRoomType } from "@modules/user/entity/ads";
import { Location } from "@modules/user/entity/location";
import { User } from "@modules/user/entity/user";
import { Vendor } from "@modules/user/entity";
import {
    IHotelDTO,
    ICreateHotelDTO,
    IUpdateHotelDTO,
} from "../dtos/hotel.dto";
import { SubscriptionType } from "@modules/user/entity/ENUM/ad-payment.enum";
import { RoomTypeEnum } from "@modules/user/entity/ENUM/ad.enum";
import { logError, logInfo } from "@lib/logger";
import { R2ClientService } from "./r2client.service";

export class HotelService {
    private hotelRepository = AppDataSource.getRepository(Hotel);
    private locationRepository = AppDataSource.getRepository(Location);
    private userRepository = AppDataSource.getRepository(User);
    private vendorRepository = AppDataSource.getRepository(Vendor);

    /**
     * Validate that a room type is a valid enum value
     */
    private validateRoomType(type: any): RoomTypeEnum {
        if (!type) throw new Error("Room type is required");
        
        const normalizedType = String(type).toLowerCase();
        const validTypes = Object.values(RoomTypeEnum);
        
        if (!validTypes.includes(normalizedType as RoomTypeEnum)) {
            throw new Error(
                `Invalid room type: "${type}". Allowed types are: ${validTypes.join(", ")}`
            );
        }
        
        return normalizedType as RoomTypeEnum;
    }


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
            vendor_id: hotel.vendor_id,
            expires_at: hotel.expires_at,
            subscription_type: hotel.subscription_type,
            is_paid: hotel.is_paid,
            is_featured: hotel.is_featured,
            is_active: hotel.is_active,
            location_id: hotel.location_id,
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
                logError(new Error(`Location not found: ${hotelData.location_id}`), 'Hotel creation');
                throw new Error(`Location with id ${hotelData.location_id} not found. Please select a valid location.`);
            }

            // Verify vendor exists if vendor_id is provided
            let actualVendorUserId: string | undefined = undefined;
            
            if (hotelData.vendor_id) {
                // First, try to find it as a vendor profile ID
                const vendorProfile = await this.vendorRepository.findOne({
                    where: { id: hotelData.vendor_id },
                    relations: ['user'],
                });

                if (vendorProfile) {
                    // vendor_id was the vendor profile ID, use the associated user ID
                    actualVendorUserId = vendorProfile.user.id;
                    logInfo('Resolved vendor profile ID to user ID', { 
                        vendorProfileId: hotelData.vendor_id, 
                        userId: actualVendorUserId 
                    });
                } else {
                    // Try to find it as a user ID directly
                    const vendor = await this.userRepository.findOne({
                        where: { id: hotelData.vendor_id },
                        relations: ['vendor'],
                    });

                    if (!vendor) {
                        logError(new Error(`Neither vendor profile nor user found: ${hotelData.vendor_id}`), 'Hotel creation');
                        throw new Error(
                            `Vendor with id ${hotelData.vendor_id} not found. ` +
                            `Please provide either a valid vendor profile ID or user ID.`
                        );
                    }

                    // Check if user is actually a vendor
                    if (!vendor.vendor) {
                        logError(new Error(`User is not a vendor: ${hotelData.vendor_id}`), 'Hotel creation');
                        throw new Error(
                            `User ${hotelData.vendor_id} is not a vendor. Only vendors can create hotels.`
                        );
                    }

                    actualVendorUserId = vendor.id;
                }
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

            // Handle subscription and vendor - use the resolved user ID
            hotel.vendor_id = actualVendorUserId;

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
                    roomType.type = this.validateRoomType(roomTypeData.type); // Validate against enum
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
            logInfo('Hotel created successfully', { id: savedHotel.id, name: savedHotel.name });
            return this.toHotelDTO(savedHotel);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            logError(error, 'Hotel creation - Database transaction');
            
            // Provide more specific error messages
            if (error.code === '23503') {  // Foreign key violation
                if (error.constraint === 'FK_c45177ca22887745a108560e181') {
                    throw new Error(`Invalid vendor_id. The vendor does not exist in the system.`);
                } else if (error.constraint === 'FK_3bdbe60c176cce275628292a8df') {
                    throw new Error(`Invalid location_id. The location does not exist.`);
                }
                throw new Error(`Foreign key constraint violation: ${error.detail || error.message}`);
            }
            
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

        // Image cleanup logic
        const r2Client = new R2ClientService();
        const imagesToDelete: string[] = [];

        if (hotelData.image !== undefined && hotelData.image !== hotel.image) {
            if (hotel.image) imagesToDelete.push(hotel.image);
            hotel.image = hotelData.image;
        }

        if (hotelData.description !== undefined)
            hotel.description = hotelData.description;
        if (hotelData.amenities !== undefined)
            hotel.amenities = hotelData.amenities;

        if (hotelData.logo !== undefined && hotelData.logo !== hotel.logo) {
            if (hotel.logo) imagesToDelete.push(hotel.logo);
            hotel.logo = hotelData.logo;
        }
        if (hotelData.verified !== undefined) hotel.verified = hotelData.verified;
        if (hotelData.phone !== undefined) hotel.phone = hotelData.phone;
        if (hotelData.whatsapp !== undefined) hotel.whatsapp = hotelData.whatsapp;
        if (hotelData.facebook !== undefined) hotel.facebook = hotelData.facebook;
        if (hotelData.instagram !== undefined) hotel.instagram = hotelData.instagram;
        if (hotelData.website !== undefined) hotel.website = hotelData.website;
        if (hotelData.vendor_id !== undefined) hotel.vendor_id = hotelData.vendor_id;
        if (hotelData.subscription_type !== undefined) hotel.subscription_type = hotelData.subscription_type;
        if (hotelData.is_active !== undefined)
            hotel.is_active = hotelData.is_active;
        if (hotelData.is_featured !== undefined)
            hotel.is_featured = hotelData.is_featured;
        if (hotelData.roomTypes !== undefined) {
            if (hotel.room_types && hotel.room_types.length > 0) {
                await this.hotelRepository
                    .createQueryBuilder()
                    .delete()
                    .from("hotel_room_types")
                    .where("hotel_id = :hotelId", { hotelId: id })
                    .execute();
            }
            hotel.room_types = hotelData.roomTypes.map((rt: any) => ({
                ...rt,
                type: this.validateRoomType(rt.type), // Validate against enum
                hotel_id: id,
            }));
        }

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

        if (imagesToDelete.length > 0) {
            r2Client.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Hotel image cleanup on update'));
        }

        return this.toHotelDTO(updatedHotel);
    }

    async deleteHotel(id: string): Promise<void> {
        const hotel = await this.hotelRepository.findOne({ where: { id } });

        if (!hotel) {
            throw new Error("Hotel not found");
        }

        const imagesToDelete: string[] = [];
        if (hotel.image) imagesToDelete.push(hotel.image);
        if (hotel.logo) imagesToDelete.push(hotel.logo);

        await this.hotelRepository.remove(hotel);

        if (imagesToDelete.length > 0) {
            const r2Client = new R2ClientService();
            r2Client.deleteFileFromR2(imagesToDelete).catch(e => logError(e, 'Hotel image cleanup on delete'));
        }
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

    async getFeaturedAds(locationId: string): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            where: { is_featured: true, is_active: true, location_id: Number(locationId) },
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
