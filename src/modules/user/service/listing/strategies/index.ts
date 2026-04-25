import { ListingType } from "@common/enums/listing.enums";
import { IListingStrategy } from "../listing-strategy.types";
import { HotelStrategy } from "./hotel.strategy";
import { RestaurantStrategy } from "./restaurant.strategy";

export { HotelStrategy } from "./hotel.strategy";
export { RestaurantStrategy } from "./restaurant.strategy";

const registry: Map<ListingType, IListingStrategy<any, any, any>> = new Map();
registry.set(ListingType.HOTEL, new HotelStrategy());
registry.set(ListingType.RESTAURANT, new RestaurantStrategy());

export function getListingStrategy<T extends IListingStrategy<any, any, any>>(
    type: ListingType,
): T {
    const strategy = registry.get(type);
    if (!strategy) {
        throw new Error(`No listing strategy registered for type "${type}"`);
    }
    return strategy as T;
}

export function listAllStrategies(): IListingStrategy<any, any, any>[] {
    return Array.from(registry.values());
}
