import {
    IRestaurantDTO,
    ICreateRestaurantDTO,
    IUpdateRestaurantDTO,
    IPaginatedRestaurantsResponse,
} from "@modules/user/dtos";
import { SubscriptionType } from "@common/enums";
import { ListingService } from "./listing/listing.service";
import { RestaurantStrategy } from "./listing/strategies/restaurant.strategy";

/**
 * Backwards-compatible facade over `ListingService` for restaurant listings.
 * Mirrors the historical `RestaurantService` API so controllers and routes
 * keep working unchanged.
 */
export class RestaurantService {
    private readonly listings = new ListingService();
    private readonly strategy = new RestaurantStrategy();

    createRestaurant(dto: ICreateRestaurantDTO): Promise<IRestaurantDTO> {
        return this.listings.create(this.strategy, dto);
    }

    getRestaurantById(id: string): Promise<IRestaurantDTO | null> {
        return this.listings.findById(this.strategy, id);
    }

    getPublicRestaurantById(id: string): Promise<IRestaurantDTO | null> {
        return this.listings.findById(this.strategy, id, { requirePublicVisible: true });
    }

    getAllRestaurants(params: {
        page?: number;
        limit?: number;
        searchQuery?: string;
        location_id?: number | number[];
        rating?: number;
        priceMax?: number;
        isFeatured?: boolean;
    } = {}): Promise<IPaginatedRestaurantsResponse> {
        return this.listings.findAll(this.strategy, params);
    }

    getRestaurantsByLocation(locationId: number | number[]): Promise<IRestaurantDTO[]> {
        return this.listings.findByLocation(this.strategy, locationId);
    }

    updateRestaurant(id: string, dto: IUpdateRestaurantDTO): Promise<IRestaurantDTO> {
        return this.listings.update(this.strategy, id, dto);
    }

    updateRestaurantByVendor(id: string, vendorId: string, dto: IUpdateRestaurantDTO): Promise<IRestaurantDTO> {
        return this.listings.updateByVendor(this.strategy, id, vendorId, dto);
    }

    deleteRestaurant(id: string): Promise<void> {
        return this.listings.delete(this.strategy, id);
    }

    toggleAdStatus(id: string, isActive: boolean): Promise<IRestaurantDTO> {
        return this.listings.toggleStatus(this.strategy, id, isActive);
    }

    renewAd(
        id: string,
        subscriptionType?: SubscriptionType,
        
    ): Promise<IRestaurantDTO> {
        return this.listings.renewByAdmin(this.strategy, id, {
            subscription_type: subscriptionType,

        });
    }

    renewAdByVendor(
        id: string,
        vendorId: string,
        subscriptionType?: SubscriptionType | string,
        
    ): Promise<IRestaurantDTO> {
        return this.listings.renewByVendor(this.strategy, id, vendorId, {
            subscription_type: subscriptionType,

        });
    }

    updateSubscriptionBilling(
        id: string,
        opts: {
            paid_at?: string;
            next_due_date?: string;
            grace_period_days?: number;
        },
    ): Promise<IRestaurantDTO> {
        return this.listings.updateSubscriptionBillingByAdmin(this.strategy, id, opts);
    }

    getExpiredAds(): Promise<IRestaurantDTO[]> {
        return this.listings.findExpired(this.strategy);
    }

    getAdsByVendor(vendorId: string): Promise<IRestaurantDTO[]> {
        return this.listings.findByVendor(this.strategy, vendorId);
    }

    setFeaturedStatus(id: string, isFeatured: boolean): Promise<IRestaurantDTO> {
        return this.listings.setFeatured(this.strategy, id, isFeatured);
    }

    async getAllRestaurantsAdmin(page = 1, limit = 50): Promise<IRestaurantDTO[]> {
        const result = await this.listings.findAll(this.strategy, {
            page,
            limit: Math.min(limit, 200),
            onlyActive: false,
            onlyPublicVisible: false,
        });
        return result.items;
    }

    getFeaturedAds(locationId: string): Promise<IRestaurantDTO[]> {
        const parsed = Number(locationId);
        return this.listings.findFeatured(this.strategy, isNaN(parsed) ? undefined : parsed);
    }

    getPremiumAds(): Promise<IRestaurantDTO[]> {
        return this.listings.findPremium(this.strategy);
    }
}
