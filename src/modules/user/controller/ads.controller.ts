import { FastifyRequest, FastifyReply } from "fastify";
import { AdsService } from "@modules/user/service/ads.service";
import { 
    IGetAdsByLocationParams, 
    IGetCombinedAdsQuery, 
    IGetAdsByVendorParams 
} from "@modules/user/types";
import { 
    ICombinedAdsResponseDTO, 
    IAdsResponseDTO,
    IHotelDTO,
    IRestaurantDTO
} from "@modules/user/dtos";

export class AdsController {
    private adsService = new AdsService();

    async getAdsByLocation(
        req: FastifyRequest<{ Params: IGetAdsByLocationParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { location_id } = req.params;
            
            // Handle multiple IDs if provided as comma-separated string
            const locationIds = String(location_id)
                .split(',')
                .map(id => parseInt(id.trim(), 10))
                .filter(id => !isNaN(id));

            if (locationIds.length === 0) {
                return reply.code(400).send({ message: "Invalid location_id" });
            }

            // Use array if multiple, otherwise single ID
            const targetId = locationIds.length === 1 ? locationIds[0] : locationIds;
            const ads: IAdsResponseDTO = await this.adsService.getAdsByLocation(targetId);
            reply.send(ads);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch ads" });
        }
    }

    async getCombinedAds(
        req: FastifyRequest<{ Querystring: IGetCombinedAdsQuery }>, 
        reply: FastifyReply
    ) {
        try {
            const { 
                page = "1", 
                limit = "10", 
                searchQuery = "", 
                type = "all",
                location_id,
                rating,
                priceMax,
                isFeatured
            } = req.query;

            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const typeValue = type.toLowerCase() as "hotel" | "restaurant" | "all";

            if (!["hotel", "restaurant", "all"].includes(typeValue)) {
                return reply.code(400).send({ message: "Invalid type. Use 'hotel', 'restaurant', or 'all'" });
            }

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

            const result: ICombinedAdsResponseDTO = await this.adsService.getCombinedAds({
                page: pageNum,
                limit: limitNum,
                searchQuery: searchQuery,
                type: typeValue,
                location_id: parsedLocationId as any,
                rating: rating ? parseFloat(rating) : undefined,
                priceMax: priceMax ? parseFloat(priceMax) : undefined,
                isFeatured: isFeatured === 'true' || isFeatured === '1' ? true : (isFeatured === 'false' || isFeatured === '0' ? false : undefined),
            });
            reply.send(result);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch ads" });
        }
    }

    async getAdsByVendor(
        req: FastifyRequest<{ Params: IGetAdsByVendorParams }>, 
        reply: FastifyReply
    ) {
        try {
            const { vendorId } = req.params;
            const authUserId = (req.user as any)?.id || (req.user as any)?.userId;
            const effectiveVendorId = authUserId || vendorId;
            const ads: (IHotelDTO | IRestaurantDTO)[] = await this.adsService.getAdsByVendor(effectiveVendorId);
            reply.send(ads);
        } catch (error: unknown) {
            const err = error as Error;
            reply
                .code(500)
                .send({ message: err.message || "Failed to fetch vendor ads" });
        }
    }
}
