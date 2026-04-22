import { AppDataSource } from "@config/ormconfig";
import { Hotel, HotelReview, HotelRoomType } from "@modules/user/entity/ads";
import { Vendor } from "@modules/user/entity/business/vendor-entity";
import { Location } from "@modules/user/entity/location";
import {
    IHotelDTO,
    ICreateHotelDTO,
    IUpdateHotelDTO,
    IPaginatedHotelsResponse,
} from "@modules/user/dtos";
import { RoomType, PropertyType, SubscriptionType, PaymentStatus, PaymentMethod } from "@common/enums";
import { PAGINATION_DEFAULTS, SUBSCRIPTION_DURATION_DAYS, FEATURED_AD_PRICE } from "@common/constants";
import { logError, logInfo, logWarn } from "@lib/logger";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { isValidUuid } from "@common/utils/uuid.util";

export class HotelService {
    private hotelRepository = AppDataSource.getRepository(Hotel);
    private locationRepository = AppDataSource.getRepository(Location);
    private vendorRepository = AppDataSource.getRepository(Vendor);

    // DB FK expects hotels.vendor_id -> user.id. Accept either user id or legacy vendor profile id.
    private async resolveVendorUserId(candidateId?: string): Promise<string | undefined> {
        if (!candidateId) return undefined;

        if (!isValidUuid(candidateId)) {
            logWarn(`Invalid UUID passed as vendor candidate ID: "${candidateId}". Skipping database lookup.`);
            return undefined; 
        }

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

    /**
     * Validate that a room type is a valid enum value
     */
    private validateRoomType(type: string | RoomType): RoomType {
        if (!type) throw new AppError("Room type is required", 400, ErrorCodes.BAD_REQUEST);
        
        const normalizedType = String(type).toLowerCase() as RoomType;
        const validTypes = Object.values(RoomType);
        
        if (!validTypes.includes(normalizedType)) {
            throw new AppError(
                `Invalid room type: "${type}". Allowed types are: ${validTypes.join(", ")}`,
                400,
                ErrorCodes.VALIDATION_ERROR
            );
        }
        
        return normalizedType;
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
            address: hotel.address,
            image: hotel.image,
            images: hotel.image ? [hotel.image] : [],
            active: hotel.is_active,
            description: hotel.description,
            amenities: hotel.amenities || [],
            logo: hotel.logo,
            verified: hotel.verified,
            links: {
                phone: hotel.phone,
                whatsapp: hotel.whatsapp,
                facebook: hotel.facebook,
                instagram: hotel.instagram,
                website: hotel.website,
                map_link: hotel.map_link,
            },
            latitude: hotel.latitude ? Number(hotel.latitude) : null,
            longitude: hotel.longitude ? Number(hotel.longitude) : null,
            detailed_reviews:
                hotel.detailed_reviews?.map((review) => ({
                    user_name: review.user_name,
                    rating: Number(review.rating),
                    comment: review.comment,
                    date: review.date,
                })) || [],
            roomTypes:
                hotel.room_types?.map((roomType) => ({
                    id: roomType.id,
                    name: roomType.name,
                    description: roomType.description,
                    type: roomType.type,
                    price: Number(roomType.price),
                    amenities: roomType.amenities || [],
                    capacity: roomType.capacity,
                    total_rooms: roomType.total_rooms,
                    images: roomType.images || [],
                    size_sqm: roomType.size_sqm ? Number(roomType.size_sqm) : undefined,
                    is_active: roomType.is_active,
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
                throw new AppError(
                    `Location with id ${hotelData.location_id} not found. Please select a valid location.`,
                    404,
                    ErrorCodes.NOT_FOUND
                );
            }

            // Create hotel entity
            const hotel = new Hotel();
            hotel.name = hotelData.name;
            hotel.price = hotelData.price;
            hotel.location_name = hotelData.location_name;
            hotel.address = hotelData.address || null;
            hotel.description = hotelData.description;
            hotel.image = hotelData.image;
            hotel.logo = hotelData.logo || null;
            hotel.amenities = hotelData.amenities || [];
            hotel.location_id = hotelData.location_id;
            hotel.location = location;

            const resolvedVendorId = await this.resolveVendorUserId(hotelData.vendor_id);
            if (resolvedVendorId) hotel.vendor_id = resolvedVendorId;

            hotel.rating = hotelData.rating || 0;
            hotel.reviews = hotelData.reviews || 0;
            hotel.verified = hotelData.verified || false;
            hotel.phone = hotelData.phone || null;
            hotel.whatsapp = hotelData.whatsapp || null;
            hotel.facebook = hotelData.facebook || null;
            hotel.instagram = hotelData.instagram || null;
            hotel.website = hotelData.website || null;
            hotel.map_link = hotelData.map_link || null;
            hotel.latitude = hotelData.latitude ?? null;
            hotel.longitude = hotelData.longitude ?? null;
            hotel.is_featured = hotelData.is_featured || false;

            // Handle subscription logic
            const subscriptionType = hotelData.subscription_type || SubscriptionType.FREE;
            hotel.subscription_type = subscriptionType;

            if (subscriptionType === SubscriptionType.FREE && !hotel.is_featured) {
                hotel.is_paid = false;
                hotel.is_active = hotelData.is_active !== undefined ? hotelData.is_active : true;

                const durationKey = subscriptionType.toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
                const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;

                const now = new Date();
                hotel.expires_at = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
            } else {
                hotel.is_paid = false;
                hotel.is_active = false; // Pending payment/admin approval
                hotel.expires_at = undefined;
            }

            const savedHotel = await queryRunner.manager.save(hotel);

            // Generate Payment Intent for non-free ads
            const vendorId = hotel.vendor_id;
            if ((subscriptionType !== SubscriptionType.FREE || hotel.is_featured) && vendorId) {
                const { SubscriptionPlanService } = await import("./subscription-plan.service");
                const planService = new SubscriptionPlanService();
                
                // Get plan by ID if provided, otherwise fallback to type
                let plan = null;
                if (hotelData.plan_id) {
                    plan = await planService.getPlanById(hotelData.plan_id);
                } else {
                    plan = await planService.getPlanByType(subscriptionType);
                }
                
                let totalAmount = plan ? Number(plan.price) : 0;

                if (hotel.is_featured) {
                    // Try to get featured plan price, or use a default if FEATURED is not a plan type
                    const featuredPlan = await planService.getPlanByType("featured" as any);
                    totalAmount += featuredPlan ? Number(featuredPlan.price) : FEATURED_AD_PRICE;
                }

                if (totalAmount > 0) {
                    const { AdPayment } = await import("@modules/user/entity/ads/ad-payment.entity");

                    const payment = new AdPayment();
                    payment.ad_id = savedHotel.id;
                    payment.ad_type = PropertyType.HOTEL;
                    payment.vendor_id = vendorId;
                    payment.amount = totalAmount;
                    payment.payment_method = PaymentMethod.BANK_TRANSFER;
                    payment.transaction_id = "PENDING_APPROVAL";
                    payment.notes = `Auto-generated payment intent for Hotel: ${hotelData.name}`;
                    payment.payment_status = PaymentStatus.PENDING;

                    await queryRunner.manager.save(AdPayment, payment);
                }
            }

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
                    roomType.name = roomTypeData.name;
                    roomType.description = roomTypeData.description || "";
                    roomType.type = roomTypeData.type ? this.validateRoomType(roomTypeData.type) : undefined as any;
                    roomType.price = roomTypeData.price;
                    roomType.amenities = roomTypeData.amenities || [];
                    roomType.capacity = roomTypeData.capacity;
                    roomType.total_rooms = roomTypeData.total_rooms || 1;
                    roomType.images = roomTypeData.images || [];
                    roomType.size_sqm = roomTypeData.size_sqm || 0;
                    roomType.is_active = roomTypeData.is_active !== undefined ? roomTypeData.is_active : true;
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
        } catch (error: unknown) {
            await queryRunner.rollbackTransaction();
            if (error instanceof AppError) throw error;
            const err = error as Error;
            logError(err, 'Hotel creation - Database transaction');
            throw new AppError(err.message || "Failed to create hotel", 500, ErrorCodes.INTERNAL_SERVER_ERROR);
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

    async getAllHotels({ 
        page = PAGINATION_DEFAULTS.PAGE, 
        limit = PAGINATION_DEFAULTS.LIMIT, 
        searchQuery = "" 
    }: { page?: number; limit?: number; searchQuery?: string }): Promise<IPaginatedHotelsResponse> {
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
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
        }

        // Update fields if provided
        if (hotelData.name !== undefined) hotel.name = hotelData.name;
        if (hotelData.rating !== undefined) hotel.rating = hotelData.rating;
        if (hotelData.reviews !== undefined) hotel.reviews = hotelData.reviews;
        if (hotelData.price !== undefined) hotel.price = hotelData.price;
        if (hotelData.location_name !== undefined)
            hotel.location_name = hotelData.location_name;
        if (hotelData.address !== undefined)
            hotel.address = hotelData.address;

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
        if (hotelData.map_link !== undefined) hotel.map_link = hotelData.map_link;
        if (hotelData.latitude !== undefined) hotel.latitude = hotelData.latitude;
        if (hotelData.longitude !== undefined) hotel.longitude = hotelData.longitude;
        
        if (hotelData.vendor_id !== undefined) {
             const resolvedVendorId = await this.resolveVendorUserId(hotelData.vendor_id);
             if (resolvedVendorId) hotel.vendor_id = resolvedVendorId;
        }

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
            hotel.room_types = hotelData.roomTypes.map((rt) => {
                const roomType = new HotelRoomType();
                roomType.name = rt.name;
                roomType.description = rt.description || "";
                roomType.type = rt.type ? this.validateRoomType(rt.type) : undefined as any;
                roomType.price = rt.price;
                roomType.amenities = rt.amenities || [];
                roomType.capacity = rt.capacity;
                roomType.total_rooms = rt.total_rooms || 1;
                roomType.images = rt.images || [];
                roomType.size_sqm = rt.size_sqm || 0;
                roomType.is_active = rt.is_active !== undefined ? rt.is_active : true;
                roomType.hotel_id = id;
                return roomType;
            });
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
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
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
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
        }

        hotel.is_active = isActive;
        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async renewAd(
        id: string,
        subscriptionType: SubscriptionType
    ): Promise<IHotelDTO> {
        const hotel = await this.hotelRepository.findOne({
            where: { id },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
        }

        // Map subscription type to constant key
        const durationKey = (subscriptionType as string).toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;

        const now = new Date();
        const currentExpiry = hotel.expires_at && hotel.expires_at > now ? hotel.expires_at : now;

        hotel.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
        hotel.subscription_type = subscriptionType;
        hotel.is_paid = true;
        hotel.is_active = true;

        const updatedHotel = await this.hotelRepository.save(hotel);
        return this.toHotelDTO(updatedHotel);
    }

    async renewAdByVendor(
        id: string,
        vendorId: string,
        subscriptionType: SubscriptionType | string
    ): Promise<IHotelDTO> {
        const resolvedVendorUserId = await this.resolveVendorUserId(vendorId);
        if (!resolvedVendorUserId) {
            throw new AppError("Unauthorized vendor", 403, ErrorCodes.FORBIDDEN);
        }

        const hotel = await this.hotelRepository.findOne({
            where: { id, vendor_id: resolvedVendorUserId },
            relations: ["location", "detailed_reviews", "room_types"],
        });

        if (!hotel) {
            throw new AppError("Hotel not found or access denied", 404, ErrorCodes.NOT_FOUND);
        }

        const { SubscriptionPlanService } = await import("./subscription-plan.service");
        const { AdPayment } = await import("@modules/user/entity/ads/ad-payment.entity");

        const durationKey = (subscriptionType as string).toUpperCase() as keyof typeof SUBSCRIPTION_DURATION_DAYS;
        const durationDays = SUBSCRIPTION_DURATION_DAYS[durationKey] || 30;

        const now = new Date();
        const currentExpiry = hotel.expires_at && hotel.expires_at > now ? hotel.expires_at : now;

        hotel.subscription_type = subscriptionType as SubscriptionType;
        hotel.is_paid = false;

        const planService = new SubscriptionPlanService();
        
        // Get plan by ID if provided, otherwise fallback to type
        let plan = null;
        if (subscriptionType.length > 20) { // Checking if it looks like a uuid
            plan = await planService.getPlanById(subscriptionType as string);
        } else {
            plan = await planService.getPlanByType(subscriptionType as any);
        }
        
        const amount = plan ? Number(plan.price) : 0;

        if (subscriptionType === SubscriptionType.FREE || amount <= 0) {
            hotel.expires_at = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000);
            hotel.is_active = true;
        } else {
            hotel.is_active = false;
            const payment = new AdPayment();
            payment.ad_id = hotel.id;
            payment.ad_type = PropertyType.HOTEL;
            payment.vendor_id = resolvedVendorUserId;
            payment.amount = amount;
            payment.payment_method = PaymentMethod.BANK_TRANSFER;
            payment.transaction_id = "PENDING_APPROVAL";
            payment.notes = `Renewal payment intent for Hotel: ${hotel.name}`;
            payment.payment_status = PaymentStatus.PENDING;
            await AppDataSource.getRepository(AdPayment).save(payment);
        }

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
        const resolvedVendorUserId = await this.resolveVendorUserId(vendorId);
        if (!resolvedVendorUserId) {
            return [];
        }

        const hotels = await this.hotelRepository.find({
            where: { vendor_id: resolvedVendorUserId },
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
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
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
