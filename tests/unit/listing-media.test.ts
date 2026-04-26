import { test } from "node:test";
import assert from "node:assert/strict";

import { ListingMediaService } from "@modules/user/service/listing/listing-media.service";
import { ListingMediaRole } from "@common/enums/listing.enums";
import { ListingMedia } from "@modules/user/entity/listing/listing-media.entity";
import type { EntityManager } from "typeorm";
import type { IMediaInput } from "@modules/user/service/listing/listing-strategy.types";

class FakeRepo {
    rows: ListingMedia[] = [];
    saved: ListingMedia[][] = [];

    constructor(initial: ListingMedia[] = []) {
        this.rows = initial;
    }

    async find(opts: any): Promise<ListingMedia[]> {
        const where = opts.where as { listing_id: string; role: any };
        let roles: ListingMediaRole[] = [];
        if (Array.isArray(where.role)) {
            roles = where.role;
        } else if (where.role && typeof where.role === "object") {
            // typeorm In() returns FindOperator with a getter `value`
            const v = (where.role as { value?: unknown })?.value;
            if (Array.isArray(v)) roles = v as ListingMediaRole[];
        }
        return this.rows.filter((r) => r.listing_id === where.listing_id && roles.includes(r.role));
    }

    async remove(rows: ListingMedia[]): Promise<void> {
        const ids = new Set(rows);
        this.rows = this.rows.filter((r) => !ids.has(r));
    }

    async save(rowOrRows: ListingMedia | ListingMedia[]): Promise<ListingMedia | ListingMedia[]> {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        for (const row of rows) {
            const idx = this.rows.findIndex(
                (existing) => existing.listing_id === row.listing_id
                    && existing.role === row.role
                    && existing.url === row.url,
            );
            if (idx >= 0) this.rows[idx] = row;
            else this.rows.push(row);
        }
        this.saved.push(rows);
        return rowOrRows;
    }
}

function makeEm(repo: FakeRepo): EntityManager {
    return {
        getRepository(target: unknown): any {
            // intercept In(...) operator: typeorm stores arrays differently.
            void target;
            return {
                find: repo.find.bind(repo),
                remove: repo.remove.bind(repo),
                save: repo.save.bind(repo),
            };
        },
    } as unknown as EntityManager;
}

function makeRow(role: ListingMediaRole, url: string, listingId = "L"): ListingMedia {
    const row = new ListingMedia();
    row.listing_id = listingId;
    row.role = role;
    row.url = url;
    row.display_order = 0;
    return row;
}

test("syncMedia returns no-op when rolesScope is empty", async () => {
    const svc = new ListingMediaService();
    const repo = new FakeRepo([]);
    const em = makeEm(repo);
    const result = await svc.syncMedia(em, "L", [{ role: ListingMediaRole.COVER, url: "u" }], []);
    assert.deepEqual(result, { deletedUrls: [] });
});

test("syncMedia: missing in payload => deleted, present => kept, new => inserted", async () => {
    const svc = new ListingMediaService();
    const existing = [
        makeRow(ListingMediaRole.COVER, "https://old/cover"),
        makeRow(ListingMediaRole.GALLERY, "https://stay/g"),
        makeRow(ListingMediaRole.GALLERY, "https://gone/g"),
    ];
    const repo = new FakeRepo(existing);
    const em = makeEm(repo);

    const next: IMediaInput[] = [
        { role: ListingMediaRole.COVER, url: "https://new/cover" },
        { role: ListingMediaRole.GALLERY, url: "https://stay/g" },
        { role: ListingMediaRole.GALLERY, url: "https://added/g" },
    ];

    const result = await svc.syncMedia(em, "L", next, [
        ListingMediaRole.COVER,
        ListingMediaRole.GALLERY,
    ]);

    assert.deepEqual(result.deletedUrls.sort(), ["https://gone/g", "https://old/cover"]);
    const urls = repo.rows.map((r) => r.url).sort();
    assert.deepEqual(urls, [
        "https://added/g",
        "https://new/cover",
        "https://stay/g",
    ]);
});

test("syncMedia: ignores inputs whose role is outside rolesScope", async () => {
    const svc = new ListingMediaService();
    const existing = [makeRow(ListingMediaRole.MENU, "https://menu1")];
    const repo = new FakeRepo(existing);
    const em = makeEm(repo);

    const next: IMediaInput[] = [
        { role: ListingMediaRole.COVER, url: "https://cover" },
        { role: ListingMediaRole.MENU, url: "https://menu2" },
    ];

    // only sync COVER -- menu rows must remain untouched
    const result = await svc.syncMedia(em, "L", next, [ListingMediaRole.COVER]);
    assert.deepEqual(result.deletedUrls, []);
    const menu = repo.rows.filter((r) => r.role === ListingMediaRole.MENU);
    assert.equal(menu.length, 1);
    assert.equal(menu[0].url, "https://menu1");
    const cover = repo.rows.filter((r) => r.role === ListingMediaRole.COVER);
    assert.equal(cover.length, 1);
    assert.equal(cover[0].url, "https://cover");
});

test("syncMedia: display_order falls back to input position", async () => {
    const svc = new ListingMediaService();
    const repo = new FakeRepo([]);
    const em = makeEm(repo);
    const next: IMediaInput[] = [
        { role: ListingMediaRole.GALLERY, url: "g1" },
        { role: ListingMediaRole.GALLERY, url: "g2" },
        { role: ListingMediaRole.GALLERY, url: "g3", display_order: 99 },
    ];
    await svc.syncMedia(em, "L", next, [ListingMediaRole.GALLERY]);
    const orders = repo.rows
        .filter((r) => r.role === ListingMediaRole.GALLERY)
        .sort((a, b) => a.display_order - b.display_order)
        .map((r) => ({ url: r.url, order: r.display_order }));
    assert.deepEqual(orders, [
        { url: "g1", order: 0 },
        { url: "g2", order: 1 },
        { url: "g3", order: 99 },
    ]);
});

test("syncMedia: dedupes (role, url) pairs in the input", async () => {
    const svc = new ListingMediaService();
    const repo = new FakeRepo([]);
    const em = makeEm(repo);
    const next: IMediaInput[] = [
        { role: ListingMediaRole.GALLERY, url: "u" },
        { role: ListingMediaRole.GALLERY, url: "u" },
    ];
    await svc.syncMedia(em, "L", next, [ListingMediaRole.GALLERY]);
    assert.equal(repo.rows.length, 1);
});
