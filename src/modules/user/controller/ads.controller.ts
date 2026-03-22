import { FastifyRequest, FastifyReply } from "fastify";
import { AdsService } from "@modules/user/service/ads.service";

export class AdsController {
    private adsService = new AdsService();

    async getAdsByLocation(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { location_id } = req.params as { location_id: string };
            const locationId = parseInt(location_id, 10);

            if (isNaN(locationId)) {
                reply.code(400).send({ message: "Invalid location_id" });
                return;
            }

            const ads = await this.adsService.getAdsByLocation(locationId);
            reply.send(ads);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch ads" });
        }
    }

    async getCombinedAds(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { page = 1, limit = 10, searchQuery = "", type = "all" } = req.query as any;
            const pageNum = parseInt(page as string, 10) || 1;
            const limitNum = parseInt(limit as string, 10) || 10;
            const typeValue = (type as string).toLowerCase() as "hotel" | "restaurant" | "all";

            if (!["hotel", "restaurant", "all"].includes(typeValue)) {
                reply.code(400).send({ message: "Invalid type. Use 'hotel', 'restaurant', or 'all'" });
                return;
            }

            const result = await this.adsService.getCombinedAds({
                page: pageNum,
                limit: limitNum,
                searchQuery: searchQuery as string,
                type: typeValue,
            });
            reply.send(result);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch ads" });
        }
    }

    async getAdsByVendor(req: FastifyRequest, reply: FastifyReply) {
        try {
            const { vendorId } = req.params as { vendorId: string };
            const authUserId = req.user?.id || req.user?.userId;
            const effectiveVendorId = authUserId || vendorId;
            const ads = await this.adsService.getAdsByVendor(effectiveVendorId);
            reply.send(ads);
        } catch (error: any) {
            reply
                .code(500)
                .send({ message: error.message || "Failed to fetch vendor ads" });
        }
    }
}
