import { test } from "node:test";
import assert from "node:assert/strict";

import { RestaurantStrategy } from "@modules/user/service/listing/strategies/restaurant.strategy";
import { ListingMediaRole, ListingType } from "@common/enums/listing.enums";
import type { ICreateRestaurantDTO, IUpdateRestaurantDTO } from "@modules/user/dtos";
import type { Listing, ListingContact, ListingMedia } from "@modules/user/entity/listing";

const baseCreate: ICreateRestaurantDTO = {
    name: "Test Resto",
    price: 50,
    location_name: "Skardu",
    image: "https://cdn/cover.webp",
    description: "Tasty",
    location_id: 2,
};

test("RestaurantStrategy.fromCreateDTO collects cover/gallery/menu media", () => {
    const strategy = new RestaurantStrategy();
    const payload = strategy.fromCreateDTO({
        ...baseCreate,
        images: ["https://cdn/cover.webp", "https://cdn/dining.webp"],
        menu_images: ["https://cdn/menu1.webp", "https://cdn/menu2.webp"],
    });

    const roles = payload.media.map((m) => m.role).sort();
    assert.deepEqual(roles, [
        ListingMediaRole.COVER,
        ListingMediaRole.GALLERY,
        ListingMediaRole.MENU,
        ListingMediaRole.MENU,
    ]);
    assert.equal(payload.type, ListingType.RESTAURANT);
});

test("RestaurantStrategy.fromUpdateDTO empty image+menu_images means rebuild media", () => {
    const strategy = new RestaurantStrategy();
    const dto: IUpdateRestaurantDTO = { menu_images: [] };
    const payload = strategy.fromUpdateDTO(dto);
    assert.deepEqual(payload.media, []);
});

test("RestaurantStrategy.toDTO includes menu_images list", () => {
    const strategy = new RestaurantStrategy();
    const listing = {
        id: "33333333-3333-3333-3333-333333333333",
        name: "Test", type: ListingType.RESTAURANT,
        rating_avg: 0, rating_count: 0, price_from: 0,
        is_active: true, is_featured: false, is_verified: false,
        description: "", amenities: [],
        latitude: null, longitude: null, vendor_id: null, location_id: 2,
    } as unknown as Listing;
    const contact: ListingContact = {
        listing_id: listing.id, phone: null, whatsapp: null,
        facebook: null, instagram: null, website: null, map_link: null, address: null,
    } as unknown as ListingContact;
    const media: ListingMedia[] = [
        { role: ListingMediaRole.COVER, url: "c", display_order: 0, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.GALLERY, url: "g1", display_order: 0, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.MENU, url: "m1", display_order: 0, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.MENU, url: "m2", display_order: 1, created_at: new Date(0) } as ListingMedia,
    ];

    const dto = strategy.toDTO({
        listing, contact, media, room_types: [], current_subscription: null, reviews: [],
        location_name: "Skardu",
    });
    assert.equal(dto.image, "c");
    assert.deepEqual(dto.images, ["c", "g1"]);
    assert.deepEqual(dto.menu_images, ["m1", "m2"]);
});
