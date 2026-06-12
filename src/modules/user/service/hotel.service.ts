import {
    IHotelDTO,
    ICreateHotelDTO,
    IUpdateHotelDTO,
    IPaginatedHotelsResponse,
} from "@modules/user/dtos";
import { SubscriptionType } from "@common/enums";
import { ListingService } from "./listing/listing.service";
import { HotelStrategy } from "./listing/strategies/hotel.strategy";

/**
 * Backwards-compatible facade over `ListingService` for hotel listings.
 *
 * The implementation collapsed to thin delegations because the heavy lifting
 * lives in the unified service; `HotelStrategy` knows how to translate the
 * `ICreateHotelDTO`/`IUpdateHotelDTO`/`IHotelDTO` shapes the existing API
 * already exposes. Routes and controllers don't need to change.
 */
export class HotelService {
    private readonly listings = new ListingService();
    private readonly strategy = new HotelStrategy();

    createHotel(dto: ICreateHotelDTO): Promise<IHotelDTO> {
        return this.listings.create(this.strategy, dto);
    }

    getHotelById(id: string): Promise<IHotelDTO | null> {
        return this.listings.findById(this.strategy, id);
    }

    getPublicHotelById(id: string): Promise<IHotelDTO | null> {
        return this.listings.findById(this.strategy, id, { requirePublicVisible: true });
    }

    getAllHotels(params: {
        page?: number;
        limit?: number;
        searchQuery?: string;
        location_id?: number | number[];
        rating?: number;
        priceMax?: number;
        isFeatured?: boolean;
    }): Promise<IPaginatedHotelsResponse> {
        return this.listings.findAll(this.strategy, params);
    }

    getHotelsByLocation(locationId: number | number[]): Promise<IHotelDTO[]> {
        return this.listings.findByLocation(this.strategy, locationId);
    }

    updateHotel(id: string, dto: IUpdateHotelDTO): Promise<IHotelDTO> {
        return this.listings.update(this.strategy, id, dto);
    }

    updateHotelByVendor(id: string, vendorId: string, dto: IUpdateHotelDTO): Promise<IHotelDTO> {
        return this.listings.updateByVendor(this.strategy, id, vendorId, dto);
    }

    deleteHotel(id: string): Promise<void> {
        return this.listings.delete(this.strategy, id);
    }

    toggleAdStatus(id: string, isActive: boolean, planId?: string): Promise<IHotelDTO> {
        return this.listings.toggleStatus(this.strategy, id, isActive, planId);
    }

    renewAd(
        id: string,
        subscriptionType?: SubscriptionType,
        planId?: string,
    ): Promise<IHotelDTO> {
        return this.listings.renewByAdmin(this.strategy, id, {
            subscription_type: subscriptionType,
            plan_id: planId,
        });
    }

    renewAdByVendor(
        id: string,
        vendorId: string,
        subscriptionType?: SubscriptionType | string,
        planId?: string,
    ): Promise<IHotelDTO> {
        return this.listings.renewByVendor(this.strategy, id, vendorId, {
            subscription_type: subscriptionType,
            plan_id: planId,
        });
    }

    getExpiredAds(): Promise<IHotelDTO[]> {
        return this.listings.findExpired(this.strategy);
    }

    getAdsByVendor(vendorId: string): Promise<IHotelDTO[]> {
        return this.listings.findByVendor(this.strategy, vendorId);
    }

    setFeaturedStatus(id: string, isFeatured: boolean): Promise<IHotelDTO> {
        return this.listings.setFeatured(this.strategy, id, isFeatured);
    }

    async getAllHotelsAdmin(page = 1, limit = 50): Promise<IHotelDTO[]> {
        const result = await this.listings.findAll(this.strategy, {
            page,
            limit: Math.min(limit, 200),
            onlyActive: false,
            onlyPublicVisible: false,
        });
        return result.items;
    }

    getFeaturedAds(locationId: string): Promise<IHotelDTO[]> {
        const parsed = Number(locationId);
        return this.listings.findFeatured(this.strategy, isNaN(parsed) ? undefined : parsed);
    }

    getPremiumAds(): Promise<IHotelDTO[]> {
        return this.listings.findPremium(this.strategy);
    }
}
