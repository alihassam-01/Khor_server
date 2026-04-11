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
            const locationId = parseInt(location_id, 10);

            if (isNaN(locationId)) {
                return reply.code(400).send({ message: "Invalid location_id" });
            }

            const ads: IAdsResponseDTO = await this.adsService.getAdsByLocation(locationId);
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
            const { page = "1", limit = "10", searchQuery = "", type = "all" } = req.query;
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const typeValue = type.toLowerCase() as "hotel" | "restaurant" | "all";

            if (!["hotel", "restaurant", "all"].includes(typeValue)) {
                return reply.code(400).send({ message: "Invalid type. Use 'hotel', 'restaurant', or 'all'" });
            }

            const result: ICombinedAdsResponseDTO = await this.adsService.getCombinedAds({
                page: pageNum,
                limit: limitNum,
                searchQuery: searchQuery,
                type: typeValue,
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
