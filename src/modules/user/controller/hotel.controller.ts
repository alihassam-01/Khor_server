import { sanitizePublicListingDTO } from "@common/utils/dto.util";
import { FastifyRequest, FastifyReply } from "fastify";
import { HotelService } from "@modules/user/service/hotel.service";
import { ICreateHotelDTO, IUpdateHotelDTO, IPaginatedHotelsResponse } from "@modules/user/dtos";
import { UserRole } from "@common/enums";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { logInfo, logWarn } from "@lib/logger";
import { isValidUuid } from "@common/utils/uuid.util";
import { extractMultipartFields, isMultipartRequest } from "@common/utils/multipart.util";
import { PAGINATION_DEFAULTS } from "@common/constants";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { 
    IHotelIdParams, 
    IGetAllHotelsQuery, 
    IToggleAdStatusBody, 
    IRenewAdBody, 
    ISetFeaturedStatusBody, 
    IHotelLocationParams,
    IVendorIdParams,
    IUpdateHotelSubscriptionBillingBody,
} from "@modules/user/types";

export class HotelController {
    private hotelService = new HotelService();
    private r2Client = new R2ClientService();

    private getAuthUserId(req: FastifyRequest): string {
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        if (!authUserId) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }
        return authUserId;
    }

    private async getVendorHotelOrThrow(hotelId: string, vendorId: string) {
        const hotels = await this.hotelService.getAdsByVendor(vendorId);
        const hotel = hotels.find((item) => item.id === hotelId);
        if (!hotel) {
            throw new AppError("Hotel not found or access denied", 404, ErrorCodes.NOT_FOUND);
        }
        return hotel;
    }

    async createHotel(
        req: FastifyRequest<{ Body: ICreateHotelDTO | any }>, 
        reply: FastifyReply
    ) {
        const userId = (req.user as any)?.id || (req.user as any)?.userId;

        if (!userId) {
            throw new AppError('Authentication required. Please log in.', 401, ErrorCodes.UNAUTHORIZED);
        }

        if (!isValidUuid(userId)) {
            logWarn(`Invalid userId (non-UUID) in HotelController: "${userId}"`);
            throw new AppError(`Invalid user identity format. Please re-login.`, 400, ErrorCodes.VALIDATION_ERROR);
        }

        const contentType = (req.headers['content-type'] || '') as string;
        let hotelData: ICreateHotelDTO;

        if (contentType.includes('multipart/form-data')) {
            const body = req.body as Record<string, any>;
            const getFieldValue = (field: any): any => {
                if (!field) return undefined;
                if (field.type === 'field' && 'value' in field) {
                    return field.value;
                }
                return field;
            };

            const extractedBody: Record<string, any> = {};
            for (const key in body) {
                extractedBody[key] = getFieldValue(body[key]);
            }

            const requiredFields = ['name', 'price', 'location_name', 'description', 'location_id'];
            const missingFields = requiredFields.filter(field => !extractedBody[field]);
            
            if (missingFields.length > 0) {
                throw new AppError(`Missing required fields: ${missingFields.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
            }

            const parseNumber = (val: any, fieldName: string, required: boolean = false): number | undefined => {
                if (!val && val !== 0) {
                    if (required) {
                        throw new AppError(`${fieldName} is required`, 400, ErrorCodes.VALIDATION_ERROR);
                    }
                    return undefined;
                }
                const parsed = Number(val);
                if (isNaN(parsed)) {
                    throw new AppError(`${fieldName} must be a valid number, got: ${val}`, 400, ErrorCodes.VALIDATION_ERROR);
                }
                return parsed;
            };

            // handle file upload for image field
            let imageUrl: string | undefined = undefined;
            if (body.image && typeof body.image !== 'string') {
                const file = body.image;
                const buffer: Buffer = file.toBuffer ? await file.toBuffer() : Buffer.from([]);
                const originalName = file.filename || 'upload';
                const mimetype = file.mimetype || 'application/octet-stream';
                const res = await this.r2Client.uploadFileToR2(buffer, originalName, mimetype);
                imageUrl = res.url;
            } else if (body.image && typeof body.image === 'string') {
                imageUrl = body.image;
            }

            // handle logo file upload
            let logoUrl: string | undefined = undefined;
            if (body.logo && typeof body.logo !== 'string') {
                const logoFile = body.logo;
                const buffer: Buffer = logoFile.toBuffer ? await logoFile.toBuffer() : Buffer.from([]);
                const res = await this.r2Client.uploadFileToR2(buffer, logoFile.filename || 'logo', logoFile.mimetype || 'application/octet-stream');
                logoUrl = res.url;
            } else if (body.logo && typeof body.logo === 'string') {
                logoUrl = body.logo;
            }

            const parseArrayField = (val: any): string[] => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                try { return JSON.parse(val); } catch { return String(val).split(',').map((s: string) => s.trim()).filter(Boolean); }
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
                logo: logoUrl || undefined,
                verified: extractedBody.verified === 'true' || extractedBody.verified === true,
                phone: extractedBody.phone || undefined,
                whatsapp: extractedBody.whatsapp || undefined,
                facebook: extractedBody.facebook || undefined,
                instagram: extractedBody.instagram || undefined,
                website: extractedBody.website || undefined,
                map_link: extractedBody.map_link || undefined,
                latitude: parseNumber(extractedBody.latitude, 'latitude'),
                longitude: parseNumber(extractedBody.longitude, 'longitude'),
                cancellation_policy: extractedBody.cancellation_policy || undefined,
                refund_cutoff_hours: parseNumber(extractedBody.refund_cutoff_hours, 'refund_cutoff_hours'),
                check_in_time: extractedBody.check_in_time || undefined,
                check_out_time: extractedBody.check_out_time || undefined,
                is_active: extractedBody.is_active === 'true' || extractedBody.is_active === true,
                subscription_type: extractedBody.subscription_type || undefined,
                plan_id: extractedBody.plan_id || undefined,
                vendor_id: (req.user as any)?.userType === UserRole.ADMIN ? (extractedBody.vendor_id || userId) : userId,
            };

            // Validate phone and whatsapp formats if provided
            const phoneRegex = /^\+?[0-9\s-]+$/;
            if (hotelData.phone && !phoneRegex.test(hotelData.phone)) {
                throw new AppError('Phone number must contain only digits, spaces, hyphens and optional leading +', 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (hotelData.whatsapp && !phoneRegex.test(hotelData.whatsapp)) {
                throw new AppError('WhatsApp number must contain only digits, spaces, hyphens and optional leading +', 400, ErrorCodes.VALIDATION_ERROR);
            }
        } else {
            // JSON request body
            const body = req.body as ICreateHotelDTO;
            
            // Validate required fields
            if (!body.name || !body.price || !body.location_name || !body.description || !body.location_id) {
                const missing = [];
                if (!body.name) missing.push('name');
                if (!body.price && body.price !== 0) missing.push('price');
                if (!body.location_name) missing.push('location_name');
                if (!body.description) missing.push('description');
                if (!body.location_id && body.location_id !== 0) missing.push('location_id');
                
                throw new AppError(`Missing required fields: ${missing.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
            }
            
            hotelData = { 
                ...body, 
                vendor_id: (req.user as any)?.userType === UserRole.ADMIN ? ((body as any).vendor_id || userId) : userId 
            };
        }

        logInfo('Creating hotel', { name: hotelData.name, location_id: hotelData.location_id });
        const hotel = await this.hotelService.createHotel(hotelData);
        logInfo('Hotel created successfully', { id: hotel.id, name: hotel.name });
        reply.code(201).send(hotel);
    }

    async getHotelById(
        req: FastifyRequest<{ Params: IHotelIdParams }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const hotel = await this.hotelService.getHotelById(id);

        if (!hotel) {
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
        }

        reply.send(hotel);
    }

    async getPublicHotelById(
        req: FastifyRequest<{ Params: IHotelIdParams }>,
        reply: FastifyReply,
    ) {
        const { id } = req.params;
        const hotel = await this.hotelService.getPublicHotelById(id);

        if (!hotel) {
            throw new AppError("Hotel not found", 404, ErrorCodes.NOT_FOUND);
        }

        reply.send(sanitizePublicListingDTO(hotel));
    }

    async getAllHotels(
        req: FastifyRequest<{ Querystring: IGetAllHotelsQuery }>, 
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

        const result: IPaginatedHotelsResponse = await this.hotelService.getAllHotels({
            page: pageNum,
            limit: limitNum,
            searchQuery: searchQuery,
            location_id: parsedLocationId,
            rating: rating ? parseFloat(rating) : undefined,
            priceMax: priceMax ? parseFloat(priceMax) : undefined,
            isFeatured: isFeatured === 'true',
        });
        result.items = result.items.map((hotel) => sanitizePublicListingDTO(hotel));
        reply.send(result);
    }

    async updateHotel(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IUpdateHotelDTO | any }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        let hotelData: IUpdateHotelDTO;
        
        const contentType = (req.headers['content-type'] || '') as string;
        if (isMultipartRequest(contentType)) {
            const body = req.body as Record<string, any>;
            hotelData = extractMultipartFields<IUpdateHotelDTO>(body, {
                price: 'number',
                location_id: 'number',
                rating: 'number',
                reviews: 'number',
                refund_cutoff_hours: 'number',
                check_in_time: 'string',
                check_out_time: 'string',
                verified: 'boolean',
                is_active: 'boolean',
                is_featured: 'boolean',
                amenities: 'array',
                images: 'array',
                roomTypes: 'json',
                promotions: 'json',
                plan_id: 'string',
            });
            // Handle image file upload
            if (body.image && typeof body.image !== 'string') {
                const file = body.image;
                const buffer: Buffer = file.toBuffer ? await file.toBuffer() : Buffer.from([]);
                const res = await this.r2Client.uploadFileToR2(buffer, file.filename || 'image', file.mimetype || 'application/octet-stream');
                hotelData.image = res.url;
            }
            // Handle logo file upload
            if (body.logo && typeof body.logo !== 'string') {
                const logoFile = body.logo;
                const buffer: Buffer = logoFile.toBuffer ? await logoFile.toBuffer() : Buffer.from([]);
                const res = await this.r2Client.uploadFileToR2(buffer, logoFile.filename || 'logo', logoFile.mimetype || 'application/octet-stream');
                hotelData.logo = res.url;
            }
        } else {
            hotelData = req.body as IUpdateHotelDTO;
        }
        const hotel = await this.hotelService.updateHotel(id, hotelData);
        reply.send(hotel);
    }

    async updateHotelByVendor(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IUpdateHotelDTO | any }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const authUserId = this.getAuthUserId(req);

        const hotelData = req.body as IUpdateHotelDTO;
        const hotel = await this.hotelService.updateHotelByVendor(id, authUserId, hotelData);
        reply.send(hotel);
    }

    async deleteVendorHotelImage(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: { image_url?: string } }>,
        reply: FastifyReply,
    ) {
        const { id } = req.params;
        const { image_url } = req.body ?? {};
        if (!image_url) {
            throw new AppError("image_url is required", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const authUserId = this.getAuthUserId(req);
        const hotel = await this.getVendorHotelOrThrow(id, authUserId);
        const nextImages = (hotel.images ?? []).filter((url) => url !== image_url);

        const updated = await this.hotelService.updateHotelByVendor(id, authUserId, {
            image: nextImages[0] ?? "",
            images: nextImages,
        });

        reply.send(updated);
    }

    async deleteHotel(
        req: FastifyRequest<{ Params: IHotelIdParams }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        await this.hotelService.deleteHotel(id);
        reply.code(204).send();
    }

    // ========== ADMIN ENDPOINTS ==========

    async toggleAdStatus(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IToggleAdStatusBody }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { is_active } = req.body;
        const hotel = await this.hotelService.toggleAdStatus(id, is_active);
        reply.send(hotel);
    }

    async renewAd(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IRenewAdBody }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { subscription_type } = req.body;
        const hotel = await this.hotelService.renewAd(id, subscription_type);
        reply.send(hotel);
    }

    async renewAdByVendor(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IRenewAdBody }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        if (!authUserId) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }

        const { subscription_type } = req.body;
        const hotel = await this.hotelService.renewAdByVendor(id, authUserId, subscription_type);
        reply.send(hotel);
    }

    async updateSubscriptionBilling(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: IUpdateHotelSubscriptionBillingBody }>,
        reply: FastifyReply,
    ) {
        const { id } = req.params;
        const hotel = await this.hotelService.updateSubscriptionBilling(id, req.body ?? {});
        reply.send(hotel);
    }

    async getExpiredAds(_req: FastifyRequest, reply: FastifyReply) {
        const hotels = await this.hotelService.getExpiredAds();
        reply.send(hotels);
    }

    async getAdsByVendor(
        req: FastifyRequest<{ Params: IVendorIdParams }>, 
        reply: FastifyReply
    ) {
        const { vendorId } = req.params;
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        const effectiveVendorId = authUserId || vendorId;
        const hotels = await this.hotelService.getAdsByVendor(effectiveVendorId);
        reply.send(hotels);
    }

    async getVendorHotels(req: FastifyRequest, reply: FastifyReply) {
        const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
        if (!authUserId) {
            throw new AppError("Authentication required. Please log in.", 401, ErrorCodes.UNAUTHORIZED);
        }

        const hotels = await this.hotelService.getAdsByVendor(authUserId);
        reply.send(hotels);
    }

    async setFeaturedStatus(
        req: FastifyRequest<{ Params: IHotelIdParams; Body: ISetFeaturedStatusBody }>, 
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const { is_featured } = req.body;
        const hotel = await this.hotelService.setFeaturedStatus(id, is_featured);
        reply.send(hotel);
    }

    async getAllHotelsAdmin(_req: FastifyRequest, reply: FastifyReply) {
        const hotels = await this.hotelService.getAllHotelsAdmin();
        reply.send(hotels);
    }

    async getFeaturedAds(
        req: FastifyRequest<{ Params: IHotelLocationParams }>, 
        reply: FastifyReply
    ) {
        const { locationId } = req.params;
        const hotels = await this.hotelService.getFeaturedAds(locationId);
        reply.send(hotels.map(h => sanitizePublicListingDTO(h)));
    }

    async getPremiumAds(_req: FastifyRequest, reply: FastifyReply) {
        const hotels = await this.hotelService.getPremiumAds();
        reply.send(hotels.map(h => sanitizePublicListingDTO(h)));
    }
}
