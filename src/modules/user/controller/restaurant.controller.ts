import { FastifyRequest, FastifyReply } from "fastify";
import { RestaurantService } from "@modules/user/service/restaurant.service";
import {
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
} from "../dtos/restaurant.dto";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { extractMultipartFields, isMultipartRequest } from "@common/utils/multipart.util";

export class RestaurantController {
    private restaurantService = new RestaurantService();
    private r2Client = new R2ClientService();

    async createRestaurant(req: FastifyRequest, reply: FastifyReply) {
        try {
            const authUserId = req.user?.id || req.user?.userId;
            if (!authUserId) {
                return reply.code(401).send({
                    message: "Authentication required. Please log in.",
                });
            }

            const contentType = (req.headers['content-type'] || '') as string;
            let restaurantData: ICreateRestaurantDTO;

            if (contentType.includes('multipart/form-data')) {
                const body: any = req.body as any;

                // Extract plain field values (skip file objects)
                const extractedBody: any = {};
                for (const key in body) {
                    const field = body[key];
                    if (field && typeof field === 'object' && field.type === 'field' && 'value' in field) {
                        extractedBody[key] = field.value;
                    } else if (typeof field === 'string') {
                        extractedBody[key] = field;
                    }
                }

                const parseNumber = (val: any): number | undefined => {
                    if (val === undefined || val === null || val === '') return undefined;
                    const parsed = Number(val);
                    return isNaN(parsed) ? undefined : parsed;
                };
                const parseArrayField = (val: any): string[] => {
                    if (!val) return [];
                    if (Array.isArray(val)) return val;
                    try { return JSON.parse(val); } catch { return []; }
                };

                // Upload main image to R2
                let imageUrl = '';
                if (body.image && typeof body.image !== 'string') {
                    const file: any = body.image;
                    const buffer: Buffer = file.toBuffer ? await file.toBuffer() : Buffer.from([]);
                    const res = await this.r2Client.uploadFileToR2(buffer, file.filename || 'image', file.mimetype || 'application/octet-stream');
                    imageUrl = res.url;
                } else if (extractedBody.image) {
                    imageUrl = extractedBody.image;
                }

                // Upload menu images to R2
                const menuImageUrls: string[] = [];
                const menuImagesRaw = body.menu_images;
                if (menuImagesRaw) {
                    const menuFiles = Array.isArray(menuImagesRaw) ? menuImagesRaw : [menuImagesRaw];
                    for (const mf of menuFiles) {
                        if (mf && typeof mf !== 'string') {
                            const buffer: Buffer = mf.toBuffer ? await mf.toBuffer() : Buffer.from([]);
                            const res = await this.r2Client.uploadFileToR2(buffer, mf.filename || 'menu', mf.mimetype || 'application/octet-stream');
                            menuImageUrls.push(res.url);
                        }
                    }
                }

                restaurantData = {
                    name: extractedBody.name,
                    location_name: extractedBody.location_name,
                    price: parseNumber(extractedBody.price) ?? 0,
                    rating: parseNumber(extractedBody.rating),
                    reviews: parseNumber(extractedBody.reviews),
                    image: imageUrl,
                    phone: extractedBody.phone || undefined,
                    whatsapp: extractedBody.whatsapp || undefined,
                    facebook: extractedBody.facebook || undefined,
                    instagram: extractedBody.instagram || undefined,
                    website: extractedBody.website || undefined,
                    description: extractedBody.description,
                    menu_images: menuImageUrls.length > 0 ? menuImageUrls : parseArrayField(extractedBody.menu_images),
                    location_id: parseNumber(extractedBody.location_id) ?? 0,
                    is_active: extractedBody.is_active === 'true' || extractedBody.is_active === true,
                    is_featured: (extractedBody.is_featured === 'true' || extractedBody.is_featured === true) as any,
                    vendor_id: extractedBody.vendor_id || undefined,
                    subscription_type: extractedBody.subscription_type || undefined,
                    map_link: extractedBody.map_link || undefined,
                    latitude: parseNumber(extractedBody.latitude) ?? undefined,
                    longitude: parseNumber(extractedBody.longitude) ?? undefined,
                } as ICreateRestaurantDTO;
            } else {
                restaurantData = req.body as ICreateRestaurantDTO;
            }

            // Do not accept vendor_id from client payload; store authenticated user id.
            restaurantData.vendor_id = authUserId;

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
            let restaurantData: IUpdateRestaurantDTO;

            if (isMultipartRequest(req.headers['content-type'])) {
                const body: any = req.body as any;
                restaurantData = extractMultipartFields<IUpdateRestaurantDTO>(body, {
                    price: 'number',
                    location_id: 'number',
                    rating: 'number',
                    reviews: 'number',
                    is_active: 'boolean',
                    is_featured: 'boolean',
                });
                // Handle main image file upload
                if (body.image && typeof body.image !== 'string') {
                    const file: any = body.image;
                    const buffer: Buffer = file.toBuffer ? await file.toBuffer() : Buffer.from([]);
                    const res = await this.r2Client.uploadFileToR2(buffer, file.filename || 'image', file.mimetype || 'application/octet-stream');
                    restaurantData.image = res.url;
                }
                // Handle menu images file uploads
                const menuImagesRaw = body.menu_images;
                if (menuImagesRaw) {
                    const menuFiles = Array.isArray(menuImagesRaw) ? menuImagesRaw : [menuImagesRaw];
                    const menuImageUrls: string[] = [];
                    for (const mf of menuFiles) {
                        if (mf && typeof mf !== 'string') {
                            const buffer: Buffer = mf.toBuffer ? await mf.toBuffer() : Buffer.from([]);
                            const res = await this.r2Client.uploadFileToR2(buffer, mf.filename || 'menu', mf.mimetype || 'application/octet-stream');
                            menuImageUrls.push(res.url);
                        }
                    }
                    if (menuImageUrls.length > 0) restaurantData.menu_images = menuImageUrls;
                }
            } else {
                restaurantData = req.body as IUpdateRestaurantDTO;
            }

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

    async renewAdByVendor(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = req.params as { id: string };
            const authUserId = req.user?.id || req.user?.userId;
            if (!authUserId) {
                return reply.code(401).send({ message: "Authentication required. Please log in." });
            }

            const { subscription_type } = req.body as { subscription_type: import("../entity/ENUM/ad-payment.enum").SubscriptionType };
            const restaurant = await this.restaurantService.renewAdByVendor(id, authUserId, subscription_type);
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
            const authUserId = req.user?.id || req.user?.userId;
            const effectiveVendorId = authUserId || vendorId;
            const restaurants = await this.restaurantService.getAdsByVendor(effectiveVendorId);
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

    async getFeaturedAds(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { locationId } = req.params as {locationId: string}
            const restaurants = await this.restaurantService.getFeaturedAds(locationId);
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
