import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "../service/hotel.service";
import { ICreateHotelDTO, IUpdateHotelDTO } from "../dtos/hotel.dto";
import { R2ClientService } from "../service/r2client.service";
import { logError, logInfo } from "../../../lib/logger";
import { extractMultipartFields, isMultipartRequest } from "../../../common/utils/multipart.util";

export class HotelController {
    private hotelService = new HotelService();
    private r2Client = new R2ClientService();

    async createHotel(req: FastifyRequest, reply: FastifyReply) {
        try {
            // const userType = req.user?.userType;
            const userId = req.user?.userId;

            if (!userId) {
                logError(new Error('Unauthenticated hotel creation attempt'), 'Hotel creation');
                return reply.code(401).send({ 
                    message: 'Authentication required. Please log in.' 
                });
            }

            // For admin routes, optionally check if user is admin
            // Uncomment if you want admin-only access:
            // if (userType !== 'admin' && userType !== 'vendor') {
            //     return reply.code(403).send({ 
            //         message: 'Only admins and vendors can create hotels.' 
            //     });
            // }

            const contentType = (req.headers['content-type'] || '') as string;
            let hotelData: ICreateHotelDTO;

            if (contentType.includes('multipart/form-data')) {
                const body: any = req.body as any;
                const getFieldValue = (field: any): any => {
                    if (!field) return undefined;
                    if (field.type === 'field' && 'value' in field) {
                        return field.value;
                    }
                    return field;
                };

                const extractedBody: any = {};
                for (const key in body) {
                    extractedBody[key] = getFieldValue(body[key]);
                }

                const requiredFields = ['name', 'price', 'location_name', 'description', 'location_id'];
                const missingFields = requiredFields.filter(field => !extractedBody[field]);
                
                if (missingFields.length > 0) {
                    logError(new Error(`Missing required fields: ${missingFields.join(', ')}`), 'Hotel creation');
                    return reply.code(400).send({ 
                        message: `Missing required fields: ${missingFields.join(', ')}` 
                    });
                }

                const parseNumber = (val: any, fieldName: string, required: boolean = false): number | undefined => {
                    if (!val && val !== 0) {
                        if (required) {
                            throw new Error(`${fieldName} is required`);
                        }
                        return undefined;
                    }
                    const parsed = Number(val);
                    if (isNaN(parsed)) {
                        throw new Error(`${fieldName} must be a valid number, got: ${val}`);
                    }
                    return parsed;
                };

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
                    name: extractedBody.name,
                    price: parseNumber(extractedBody.price, 'price', true)!,
                    location_name: extractedBody.location_name,
                    image: imageUrl || extractedBody.image || '',
                    description: extractedBody.description,
                    amenities: parseArrayField(extractedBody.amenities),
                    location_id: parseNumber(extractedBody.location_id, 'location_id', true)!,
                    rating: parseNumber(extractedBody.rating, 'rating'),
                    reviews: parseNumber(extractedBody.reviews, 'reviews'),
                    logo: extractedBody.logo || undefined,
                    verified: extractedBody.verified === 'true' || extractedBody.verified === true,
                    phone: extractedBody.phone || undefined,
                    whatsapp: extractedBody.whatsapp || undefined,
                    facebook: extractedBody.facebook || undefined,
                    instagram: extractedBody.instagram || undefined,
                    website: extractedBody.website || undefined,
                    detailed_reviews: extractedBody.detailed_reviews || undefined,
                    roomTypes: extractedBody.roomTypes || undefined,
                    vendor_id: extractedBody.vendor_id || undefined,
                    subscription_type: extractedBody.subscription_type || undefined,
                    is_active: extractedBody.is_active === 'true' || extractedBody.is_active === true,
                } as ICreateHotelDTO;
            } else {
                // JSON request body
                const body = req.body as any;
                
                // Validate required fields for JSON too
                if (!body.name || !body.price || !body.location_name || !body.description || !body.location_id) {
                    const missing = [];
                    if (!body.name) missing.push('name');
                    if (!body.price && body.price !== 0) missing.push('price');
                    if (!body.location_name) missing.push('location_name');
                    if (!body.description) missing.push('description');
                    if (!body.location_id && body.location_id !== 0) missing.push('location_id');
                    
                    logError(new Error(`Missing required fields: ${missing.join(', ')}`), 'Hotel creation (JSON)');
                    return reply.code(400).send({ 
                        message: `Missing required fields: ${missing.join(', ')}` 
                    });
                }
                
                hotelData = body as ICreateHotelDTO;
            }

            logInfo('Creating hotel', { name: hotelData.name, location_id: hotelData.location_id });
            const hotel = await this.hotelService.createHotel(hotelData);
            logInfo('Hotel created successfully', { id: hotel.id, name: hotel.name });
            reply.code(201).send(hotel);
        } catch (error: any) {
            logError(error, 'Hotel creation');
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
            let hotelData: IUpdateHotelDTO;
            
            if (isMultipartRequest(req.headers['content-type'])) {
                hotelData = extractMultipartFields<IUpdateHotelDTO>(req.body, {
                    price: 'number',
                    location_id: 'number',
                    rating: 'number',
                    reviews: 'number',
                    verified: 'boolean',
                    is_active: 'boolean',
                    amenities: 'array',
                    roomTypes: 'json',
                });
            } else {
                hotelData = req.body as IUpdateHotelDTO;
            }
            
            const hotel = await this.hotelService.updateHotel(id, hotelData);
            reply.send(hotel);
        } catch (error: any) {
            logError(error, 'Hotel update');
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
