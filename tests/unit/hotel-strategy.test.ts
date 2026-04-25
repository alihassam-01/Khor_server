import { test } from "node:test";
import assert from "node:assert/strict";

import { HotelStrategy } from "@modules/user/service/listing/strategies/hotel.strategy";
import { ListingMediaRole, ListingType } from "@common/enums/listing.enums";
import type { ICreateHotelDTO, IUpdateHotelDTO } from "@modules/user/dtos";
import type { Listing, ListingContact, ListingMedia } from "@modules/user/entity/listing";

const baseCreate: ICreateHotelDTO = {
    name: "Test Hotel",
    price: 100,
    location_name: "Hunza",
    image: "https://cdn.example/cover.webp",
    description: "A nice hotel",
    amenities: ["wifi", "pool"],
    location_id: 1,
};

test("HotelStrategy.fromCreateDTO maps cover/logo/gallery into media payload", () => {
    const strategy = new HotelStrategy();
    const payload = strategy.fromCreateDTO({
        ...baseCreate,
        logo: "https://cdn.example/logo.webp",
        images: [
            "https://cdn.example/cover.webp", // duplicate of cover -- should be skipped
            "https://cdn.example/g1.webp",
            "https://cdn.example/g2.webp",
        ],
    });

    assert.equal(payload.type, ListingType.HOTEL);
    assert.equal(payload.name, "Test Hotel");
    assert.equal(payload.price_from, 100);
    assert.deepEqual(payload.amenities, ["wifi", "pool"]);
    const roles = payload.media.map((m) => m.role);
    assert.deepEqual(roles, [
        ListingMediaRole.COVER,
        ListingMediaRole.LOGO,
        ListingMediaRole.GALLERY,
        ListingMediaRole.GALLERY,
    ]);
    assert.equal(payload.media.find((m) => m.role === ListingMediaRole.LOGO)?.url,
        "https://cdn.example/logo.webp");
});

test("HotelStrategy.fromCreateDTO trims contact + verifies booleans", () => {
    const strategy = new HotelStrategy();
    const payload = strategy.fromCreateDTO({
        ...baseCreate,
        verified: true,
        is_featured: true,
        phone: "+92 333 1234567",
        whatsapp: "+92 333 1234567",
        facebook: "https://fb.example/x",
    });
    assert.equal(payload.is_featured, true);
    assert.equal(payload.is_verified, true);
    assert.equal(payload.contact.phone, "+92 333 1234567");
    assert.equal(payload.contact.facebook, "https://fb.example/x");
});

test("HotelStrategy.fromUpdateDTO only includes touched fields", () => {
    const strategy = new HotelStrategy();
    const dto: IUpdateHotelDTO = { name: "Renamed", phone: "+1" };
    const payload = strategy.fromUpdateDTO(dto);

    assert.equal(payload.name, "Renamed");
    assert.equal(payload.description, undefined);
    assert.equal(payload.price_from, undefined);
    assert.equal(payload.contact?.phone, "+1");
    assert.equal(payload.contact?.whatsapp, undefined);
});

test("HotelStrategy.fromUpdateDTO image-only update sets cover media only", () => {
    const strategy = new HotelStrategy();
    const dto: IUpdateHotelDTO = { image: "https://cdn.example/new-cover.webp" };
    const payload = strategy.fromUpdateDTO(dto);
    assert.equal(payload.media?.length, 1);
    assert.equal(payload.media?.[0].role, ListingMediaRole.COVER);
});

test("HotelStrategy.toDTO assembles legacy hotel response", () => {
    const strategy = new HotelStrategy();
    const listing = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Test Hotel",
        type: ListingType.HOTEL,
        rating_avg: 4.5,
        rating_count: 12,
        price_from: 100,
        is_active: true,
        is_featured: false,
        is_verified: true,
        description: "Cozy",
        amenities: ["wifi"],
        latitude: null,
        longitude: null,
        vendor_id: null,
        location_id: 1,
    } as unknown as Listing;
    const contact = {
        phone: "+92",
        whatsapp: null, facebook: null, instagram: null, website: null, map_link: null,
        address: "Main road",
    } as unknown as ListingContact;
    const media: ListingMedia[] = [
        { role: ListingMediaRole.COVER, url: "https://cdn/cover.webp", display_order: 0, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.GALLERY, url: "https://cdn/g1.webp", display_order: 1, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.GALLERY, url: "https://cdn/g2.webp", display_order: 0, created_at: new Date(0) } as ListingMedia,
        { role: ListingMediaRole.LOGO, url: "https://cdn/logo.webp", display_order: 0, created_at: new Date(0) } as ListingMedia,
    ];

    const dto = strategy.toDTO({
        listing,
        contact,
        media,
        room_types: [],
        current_subscription: null,
        reviews: [],
        location_name: "Hunza",
    });

    assert.equal(dto.id, listing.id);
    assert.equal(dto.image, "https://cdn/cover.webp");
    assert.equal(dto.logo, "https://cdn/logo.webp");
    assert.equal(dto.location, "Hunza");
    assert.equal(dto.address, "Main road");
    assert.equal(dto.verified, true);
    assert.equal(dto.rating, 4.5);
    assert.equal(dto.reviews, 12);
    // gallery sorted by display_order, cover first, no duplicates of cover
    assert.deepEqual(dto.images, ["https://cdn/cover.webp", "https://cdn/g2.webp", "https://cdn/g1.webp"]);
});

test("HotelStrategy.toDTO falls back to first gallery when no cover", () => {
    const strategy = new HotelStrategy();
    const listing = {
        id: "22222222-2222-2222-2222-222222222222",
        name: "X",
        type: ListingType.HOTEL,
        rating_avg: 0, rating_count: 0, price_from: 0,
        is_active: true, is_featured: false, is_verified: false,
        description: "", amenities: [],
        latitude: null, longitude: null, vendor_id: null, location_id: 1,
    } as unknown as Listing;
    const media: ListingMedia[] = [
        { role: ListingMediaRole.GALLERY, url: "https://cdn/g.webp", display_order: 0, created_at: new Date() } as ListingMedia,
    ];
    const dto = strategy.toDTO({
        listing,
        contact: null,
        media,
        room_types: [],
        current_subscription: null,
        reviews: [],
    });
    assert.equal(dto.image, "https://cdn/g.webp");
});
