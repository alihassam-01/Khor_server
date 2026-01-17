import { AppDataSource } from "../../../config/ormconfig";
import { Hotel, HotelReview, HotelRoomType } from "../entity/ads";
import { Location } from "../entity/location";
import {
    IHotelDTO,
    ICreateHotelDTO,
    IUpdateHotelDTO,
} from "../dtos/hotel.dto";

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
            hotel.location = location;
            hotel.location_id = hotelData.location_id;
            hotel.is_active = hotelData.is_active !== undefined ? hotelData.is_active : true;

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

    async getAllHotels(): Promise<IHotelDTO[]> {
        const hotels = await this.hotelRepository.find({
            relations: ["location", "detailed_reviews", "room_types"],
            order: { created_at: "DESC" },
        });

        return hotels.map((hotel) => this.toHotelDTO(hotel));
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
}
