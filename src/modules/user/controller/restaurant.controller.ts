import { FastifyRequest, FastifyReply } from "fastify";
import { RestaurantService } from "@modules/user/service/restaurant.service";
import {
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
    IPaginatedRestaurantsResponse
} from "@modules/user/dtos";
import { UserRole } from "@common/enums";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { extractMultipartFields, isMultipartRequest } from "@common/utils/multipart.util";
import { PAGINATION_DEFAULTS } from "@common/constants";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logWarn } from "@lib/logger";
import { isValidUuid } from "@common/utils/uuid.util";
import {
    IRestaurantIdParams,
    IGetAllRestaurantsQuery,
    IToggleRestaurantAdStatusBody,
    IRenewRestaurantAdBody,
    ISetRestaurantFeaturedStatusBody,
    IHotelLocationParams,
    IVendorIdParams
} from "@modules/user/types";

export class RestaurantController {
    private restaurantService = new RestaurantService();
    private r2Client = new R2ClientService();

    async createRestaurant(
        req: FastifyRequest<{ Body: ICreateRestaurantDTO | any }>,
        reply: FastifyReply
    ) {
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        if (!authUserId) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }
        if (!isValidUuid(authUserId)) {
            logWarn(`Invalid authUserId (non-UUID) in RestaurantController: "${authUserId}"`);
            throw new AppError(`Invalid user identity format. Please re-login.`, 400, ErrorCodes.VALIDATION_ERROR);
        }

        const contentType = (req.headers['content-type'] || '') as string;
        let restaurantData: ICreateRestaurantDTO;

        if (contentType.includes('multipart/form-data')) {
            const body = req.body as Record<string, any>;

            // Extract plain field values
            const extractedBody: Record<string, any> = {};
            for (const key in body) {
                const field = body[key];
                if (field && typeof field === 'object' && field.type === 'field' && 'value' in field) {
                    extractedBody[key] = field.value;
                } else if (typeof field === 'string') {
                    extractedBody[key] = field;
                }
            }

            const parseNumber = (val: any, fieldName?: string): number | undefined => {
                if (val === undefined || val === null || val === '') return undefined;
                const parsed = Number(val);
                if (isNaN(parsed)) {
                    throw new AppError(`${fieldName || 'Field'} must be a valid number, got: ${val}`, 400, ErrorCodes.VALIDATION_ERROR);
                }
                return parsed;
            };
            const parseArrayField = (val: any): string[] => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val); } catch { return []; }
            };

            // Upload main image to R2
            let imageUrl = '';
            if (body.image && typeof body.image !== 'string') {
                const file = body.image;
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
                price: parseNumber(extractedBody.price, 'price') ?? 0,
                rating: parseNumber(extractedBody.rating, 'rating'),
                reviews: parseNumber(extractedBody.reviews, 'reviews'),
                image: imageUrl,
                phone: extractedBody.phone || undefined,
                whatsapp: extractedBody.whatsapp || undefined,
                facebook: extractedBody.facebook || undefined,
                instagram: extractedBody.instagram || undefined,
                website: extractedBody.website || undefined,
                description: extractedBody.description || "",
                menu_images: menuImageUrls.length > 0 ? menuImageUrls : parseArrayField(extractedBody.menu_images),
                location_id: parseNumber(extractedBody.location_id, 'location_id') ?? 0,
                is_active: extractedBody.is_active === 'true' || extractedBody.is_active === true,
                is_featured: extractedBody.is_featured === 'true' || extractedBody.is_featured === true,
                subscription_type: extractedBody.subscription_type || undefined,
                map_link: extractedBody.map_link || undefined,
                latitude: parseNumber(extractedBody.latitude, 'latitude'),
                longitude: parseNumber(extractedBody.longitude, 'longitude'),
                vendor_id: (req.user as any)?.userType === UserRole.ADMIN ? (extractedBody.vendor_id || authUserId) : authUserId,
            };

            // Validate phone and whatsapp formats if provided
            const phoneRegex = /^\+?[0-9\s-]+$/;
            if (restaurantData.phone && !phoneRegex.test(restaurantData.phone)) {
                throw new AppError('Phone number must contain only digits, spaces, hyphens and optional leading +', 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (restaurantData.whatsapp && !phoneRegex.test(restaurantData.whatsapp)) {
                throw new AppError('WhatsApp number must contain only digits, spaces, hyphens and optional leading +', 400, ErrorCodes.VALIDATION_ERROR);
            }
        } else {
            const body = req.body as ICreateRestaurantDTO;
            restaurantData = {
                ...body,
                vendor_id: (req.user as any)?.userType === UserRole.ADMIN ? ((body as any).vendor_id || authUserId) : authUserId 
            };
        }

        const restaurant = await this.restaurantService.createRestaurant(restaurantData);
        reply.code(201).send(restaurant);
    }

    async getRestaurantById(
        req: FastifyRequest<{ Params: IRestaurantIdParams }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const restaurant = await this.restaurantService.getRestaurantById(id);

        if (!restaurant) {
            throw new AppError("Restaurant not found", 404, ErrorCodes.NOT_FOUND);
        }

        reply.send(restaurant);
    }

    async getAllRestaurants(
        req: FastifyRequest<{ Querystring: IGetAllRestaurantsQuery }>,
        reply: FastifyReply
    ) {
        const {
            page = String(PAGINATION_DEFAULTS.PAGE),
            limit = String(PAGINATION_DEFAULTS.LIMIT),
            searchQuery = "",
            location_id,
            rating,
            priceMax,
            isFeatured
        } = req.query;

        const pageNum = parseInt(page, 10) || PAGINATION_DEFAULTS.PAGE;
        const limitNum = parseInt(limit, 10) || PAGINATION_DEFAULTS.LIMIT;

        // Handle multiple location IDs if provided as comma-separated string
        let parsedLocationId: number | number[] | undefined = undefined;
        if (location_id) {
            const locStr = String(location_id);
            if (locStr.includes(',')) {
                parsedLocationId = locStr.split(',')
                    .map(id => parseInt(id.trim(), 10))
                    .filter(id => !isNaN(id));
            } else {
                const parsed = parseInt(locStr, 10);
                if (!isNaN(parsed)) parsedLocationId = parsed;
            }
        }

        const result: IPaginatedRestaurantsResponse = await this.restaurantService.getAllRestaurants({
            page: pageNum,
            limit: limitNum,
            searchQuery: searchQuery,
            location_id: parsedLocationId,
            rating: rating ? parseFloat(rating) : undefined,
            priceMax: priceMax ? parseFloat(priceMax) : undefined,
            isFeatured: isFeatured === 'true',
        });
        reply.send(result);
    }

    async updateRestaurant(
        req: FastifyRequest<{ Params: IRestaurantIdParams; Body: IUpdateRestaurantDTO | any }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        let restaurantData: IUpdateRestaurantDTO;

        const contentType = (req.headers['content-type'] || '') as string;
        if (isMultipartRequest(contentType)) {
            const body = req.body as Record<string, any>;
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
                const file = body.image;
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

        const restaurant = await this.restaurantService.updateRestaurant(id, restaurantData);
        reply.send(restaurant);
    }

    async deleteRestaurant(
        req: FastifyRequest<{ Params: IRestaurantIdParams }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        await this.restaurantService.deleteRestaurant(id);
        reply.code(204).send();
    }

    // ========== ADMIN ENDPOINTS ==========

    async toggleAdStatus(
        req: FastifyRequest<{ Params: IRestaurantIdParams; Body: IToggleRestaurantAdStatusBody }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { is_active } = req.body;
        const restaurant = await this.restaurantService.toggleAdStatus(id, is_active);
        reply.send(restaurant);
    }

    async renewAd(
        req: FastifyRequest<{ Params: IRestaurantIdParams; Body: IRenewRestaurantAdBody }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { subscription_type } = req.body;
        const restaurant = await this.restaurantService.renewAd(id, subscription_type);
        reply.send(restaurant);
    }

    async renewAdByVendor(
        req: FastifyRequest<{ Params: IRestaurantIdParams; Body: IRenewRestaurantAdBody }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        if (!authUserId) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }

        const { subscription_type } = req.body;
        const restaurant = await this.restaurantService.renewAdByVendor(id, authUserId, subscription_type);
        reply.send(restaurant);
    }

    async getExpiredAds(_req: FastifyRequest, reply: FastifyReply) {
        const restaurants = await this.restaurantService.getExpiredAds();
        reply.send(restaurants);
    }

    async getAdsByVendor(
        req: FastifyRequest<{ Params: IVendorIdParams }>,
        reply: FastifyReply
    ) {
        const { vendorId } = req.params;
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        const effectiveVendorId = authUserId || vendorId;
        const restaurants = await this.restaurantService.getAdsByVendor(effectiveVendorId);
        reply.send(restaurants);
    }

    async setFeaturedStatus(
        req: FastifyRequest<{ Params: IRestaurantIdParams; Body: ISetRestaurantFeaturedStatusBody }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { is_featured } = req.body;
        const restaurant = await this.restaurantService.setFeaturedStatus(id, is_featured);
        reply.send(restaurant);
    }

    async getAllRestaurantsAdmin(_req: FastifyRequest, reply: FastifyReply) {
        const restaurants = await this.restaurantService.getAllRestaurantsAdmin();
        reply.send(restaurants);
    }

    async getFeaturedAds(
        req: FastifyRequest<{ Params: IHotelLocationParams }>,
        reply: FastifyReply
    ) {
        const { locationId } = req.params;
        const restaurants = await this.restaurantService.getFeaturedAds(locationId);
        reply.send(restaurants);
    }

    async getPremiumAds(_req: FastifyRequest, reply: FastifyReply) {
        const restaurants = await this.restaurantService.getPremiumAds();
        reply.send(restaurants);
    }
}
