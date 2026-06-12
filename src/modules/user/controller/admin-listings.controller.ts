import { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { AdminListingsService } from "@modules/user/service/admin-listings.service";
import { IUpdateListingVisibilityDto } from "@modules/user/types/admin-listings.types";

type ListingParams = {
    id: string;
};

export class AdminListingsController {
    constructor(private readonly service: AdminListingsService) {}

    async listListings(_request: FastifyRequest, reply: FastifyReply) {
        const listings = await this.service.listListings();
        reply.send(listings);
    }

    async updatePublicVisibility(
        request: FastifyRequest<{ Params: ListingParams; Body: IUpdateListingVisibilityDto }>,
        reply: FastifyReply,
    ) {
        if (typeof request.body?.is_public_visible !== "boolean") {
            throw new AppError("is_public_visible is required", 400, ErrorCodes.BAD_REQUEST);
        }

        const listing = await this.service.updatePublicVisibility(request.params.id, request.body);
        reply.send(listing);
    }
}
