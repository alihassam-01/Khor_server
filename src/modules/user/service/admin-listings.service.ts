import { AppDataSource } from "@config/ormconfig";
import { Listing } from "@modules/user/entity/listing";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { ListingType } from "@common/enums/listing.enums";
import { In } from "typeorm";
import {
    IAdminListingDto,
    IUpdateListingVisibilityDto,
    IBulkUpdateListingVisibilityDto,
} from "@modules/user/types/admin-listings.types";

export class AdminListingsService {
    private readonly listingRepo = AppDataSource.getRepository(Listing);

    async listListings(): Promise<IAdminListingDto[]> {
        const rows = await this.listingRepo.find({
            where: [
                { type: ListingType.HOTEL },
                { type: ListingType.RESTAURANT },
            ],
            relations: ["location", "vendor", "vendor.profile"],
            order: { updated_at: "DESC" },
        });

        return rows.map((listing) => ({
            id: listing.id,
            type: listing.type,
            name: listing.name,
            status: listing.status,
            isActive: listing.is_active,
            isFeatured: listing.is_featured,
            isPublicVisible: listing.is_public_visible,
            visibilityNote: listing.visibility_note ?? null,
            locationName: listing.location?.name ?? null,
            vendorName: listing.vendor?.profile?.username ?? listing.vendor?.email ?? null,
            createdAt: listing.created_at.toISOString(),
            updatedAt: listing.updated_at.toISOString(),
        }));
    }

    async updatePublicVisibility(
        id: string,
        payload: IUpdateListingVisibilityDto,
    ): Promise<IAdminListingDto> {
        const listing = await this.listingRepo.findOne({
            where: { id },
            relations: ["location", "vendor", "vendor.profile"],
        });

        if (!listing || (listing.type !== ListingType.HOTEL && listing.type !== ListingType.RESTAURANT)) {
            throw new AppError("Listing not found", 404, ErrorCodes.NOT_FOUND);
        }

        listing.is_public_visible = payload.is_public_visible;
        listing.visibility_note = payload.visibility_note?.trim() || null;

        const saved = await this.listingRepo.save(listing);

        return {
            id: saved.id,
            type: saved.type,
            name: saved.name,
            status: saved.status,
            isActive: saved.is_active,
            isFeatured: saved.is_featured,
            isPublicVisible: saved.is_public_visible,
            visibilityNote: saved.visibility_note ?? null,
            locationName: saved.location?.name ?? null,
            vendorName: saved.vendor?.profile?.username ?? saved.vendor?.email ?? null,
            createdAt: saved.created_at.toISOString(),
            updatedAt: saved.updated_at.toISOString(),
        };
    }

    async bulkUpdatePublicVisibility(payload: IBulkUpdateListingVisibilityDto): Promise<{ updated: number }> {
        const types =
            payload.type === "hotel"
                ? [ListingType.HOTEL]
                : payload.type === "restaurant"
                    ? [ListingType.RESTAURANT]
                    : [ListingType.HOTEL, ListingType.RESTAURANT];

        const result = await this.listingRepo.update(
            { type: In(types) },
            {
                is_public_visible: payload.is_public_visible,
                visibility_note: payload.is_public_visible
                    ? null
                    : "Hidden from public frontend by admin (bulk action).",
            },
        );

        return { updated: result.affected ?? 0 };
    }
}
