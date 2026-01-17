import { FastifyRequest, FastifyReply } from "fastify";
import { AdsService } from "../service/ads.service";

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
}
