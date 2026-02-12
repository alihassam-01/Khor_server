import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "../service/hotel.service";
import { ICreateHotelDTO, IUpdateHotelDTO } from "../dtos/hotel.dto";
import { R2ClientService } from "../service/r2client.service";

export class HotelController {
    private hotelService = new HotelService();
    private r2Client = new R2ClientService();

    async createHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const contentType = (req.headers['content-type'] || '') as string;
            let hotelData: ICreateHotelDTO;

            if (contentType.includes('multipart/form-data')) {
                // fields are attached to body because attachFieldsToBody:true
                const body: any = req.body as any;

                // handle file upload for image field
                let imageUrl: string | undefined = undefined;
                if (body.image && typeof body.image !== 'string') {
                    // fastify-multipart file object supports toBuffer()
                    const file: any = body.image;
                    const buffer: Buffer = file.toBuffer ? await file.toBuffer() : Buffer.from([]);
                    const originalName = file.filename || 'upload';
                    const mimetype = file.mimetype || 'application/octet-stream';
                    const res = await this.r2Client.uploadFileToR2(buffer, originalName, mimetype);
                    imageUrl = res.url;
                } else if (body.image && typeof body.image === 'string') {
                    imageUrl = body.image;
                }

                const parseArrayField = (val: any) => {
                    if (!val) return [];
                    if (Array.isArray(val)) return val;
                    try { return JSON.parse(val); } catch { return String(val).split(',').map((s:any)=>s.trim()).filter(Boolean); }
                };

                hotelData = {
                    name: body.name,
                    price: Number(body.price),
                    location_name: body.location_name,
                    image: imageUrl || '',
                    description: body.description,
                    amenities: parseArrayField(body.amenities),
                    location_id: Number(body.location_id),
                    rating: body.rating ? Number(body.rating) : undefined,
                    reviews: body.reviews ? Number(body.reviews) : undefined,
                    logo: body.logo || undefined,
                    verified: body.verified === 'true' || body.verified === true,
                    phone: body.phone || undefined,
                    whatsapp: body.whatsapp || undefined,
                    facebook: body.facebook || undefined,
                    instagram: body.instagram || undefined,
                    website: body.website || undefined,
                    detailed_reviews: body.detailed_reviews || undefined,
                    roomTypes: body.roomTypes || undefined,
                    vendor_id: body.vendor_id || undefined,
                    subscription_type: body.subscription_type || undefined,
                } as ICreateHotelDTO;
            } else {
                hotelData = req.body as ICreateHotelDTO;
            }

            const hotel = await this.hotelService.createHotel(hotelData);
            reply.code(201).send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to create hotel" });
        }
    }

    async getHotelById(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const hotel = await this.hotelService.getHotelById(id);

            if (!hotel) {
                reply.code(404).send({ message: "Hotel not found" });
                return;
            }

            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch hotel" });
        }
    }

    async getAllHotels(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { page = 1, limit = 10, searchQuery = "" } = req.query as any;
            const pageNum = parseInt(page as string, 10) || 1;
            const limitNum = parseInt(limit as string, 10) || 10;
            const result = await this.hotelService.getAllHotels({
                page: pageNum,
                limit: limitNum,
                searchQuery: searchQuery as string,
            });
            reply.send(result);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch hotels" });
        }
    }

    async updateHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const hotelData = req.body as IUpdateHotelDTO;
            const hotel = await this.hotelService.updateHotel(id, hotelData);
            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to update hotel" });
        }
    }

    async deleteHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            await this.hotelService.deleteHotel(id);
            reply.code(204).send();
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to delete hotel" });
        }
    }

    // ========== ADMIN ENDPOINTS ==========

    async toggleAdStatus(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const { is_active } = req.body as { is_active: boolean };
            const hotel = await this.hotelService.toggleAdStatus(id, is_active);
            reply.send(hotel);
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
            const hotel = await this.hotelService.renewAd(id, subscription_type);
            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to renew ad" });
        }
    }

    async getExpiredAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotels = await this.hotelService.getExpiredAds();
            reply.send(hotels);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch expired ads" });
        }
    }

    async getAdsByVendor(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { vendorId } = req.params as { vendorId: string };
            const hotels = await this.hotelService.getAdsByVendor(vendorId);
            reply.send(hotels);
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
            const hotel = await this.hotelService.setFeaturedStatus(id, is_featured);
            reply.send(hotel);
        } catch (error: any) {
            reply
                .code(400)
                .send({ message: error.message || "Failed to set featured status" });
        }
    }

    async getAllHotelsAdmin(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotels = await this.hotelService.getAllHotelsAdmin();
            reply.send(hotels);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch hotels" });
        }
    }

    async getFeaturedAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotels = await this.hotelService.getFeaturedAds();
            reply.send(hotels);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch featured ads" });
        }
    }

    async getPremiumAds(_req: FastifyRequest, reply: FastifyReply) {
        try {
            const hotels = await this.hotelService.getPremiumAds();
            reply.send(hotels);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch premium ads" });
        }
    }
}
