import { EntityManager, In } from "typeorm";
import { ListingMedia } from "@modules/user/entity/listing/listing-media.entity";
import { Listing } from "@modules/user/entity/listing/listing.entity";
import { ListingMediaRole } from "@common/enums/listing.enums";
import { S3ImagesEntity } from "@modules/user/entity/images/s3Images.entity";
import { R2ClientService } from "@modules/user/service/r2client.service";
import { logError } from "@lib/logger";
import { IMediaInput } from "./listing-strategy.types";

/**
 * Manages the rows in `listing_media`. Treats the request as the source of
 * truth: anything in the new payload survives; anything not in it for the
 * given roles is removed (and its underlying R2 object marked deleted).
 *
 * The strategy decides which roles are "owned" by a given write — for
 * example, a hotel update that only sets `image` (cover) replaces *just*
 * the cover, not the gallery or menu.
 */
export class ListingMediaService {
    private r2 = new R2ClientService();

    /**
     * Replace media for the given listing/roles with the new inputs.
     *
     * Diff semantics: keys are `(role, url)` pairs. Anything in `rolesScope`
     * not present in the new payload is removed and queued for R2 deletion.
     * Anything present is upserted in-place.
     *
     * `display_order` falls back to the position in the input array if the
     * caller didn't set one explicitly — keeps gallery ordering stable
     * without forcing controllers to assign indices manually.
     */
    async syncMedia(
        em: EntityManager,
        listingId: string,
        nextInputs: IMediaInput[],
        rolesScope: ListingMediaRole[],
    ): Promise<{ deletedUrls: string[] }> {
        if (rolesScope.length === 0) {
            return { deletedUrls: [] };
        }

        const repo = em.getRepository(ListingMedia);
        const existing = await repo.find({
            where: { listing_id: listingId, role: In(rolesScope) },
        });

        const inScopeInputs = nextInputs.filter((m) => rolesScope.includes(m.role));
        const wantKeys = new Set(inScopeInputs.map((m) => `${m.role}::${m.url}`));
        const toDelete = existing.filter((row) => !wantKeys.has(`${row.role}::${row.url}`));
        const keptByKey = new Map<string, ListingMedia>();
        for (const row of existing) {
            const key = `${row.role}::${row.url}`;
            if (wantKeys.has(key)) keptByKey.set(key, row);
        }

        if (toDelete.length > 0) {
            await repo.remove(toDelete);
        }

        const toUpsert: ListingMedia[] = [];
        const seen = new Set<string>();
        inScopeInputs.forEach((input, idx) => {
            const key = `${input.role}::${input.url}`;
            if (seen.has(key)) return; // de-dupe within payload
            seen.add(key);
            const existingRow = keptByKey.get(key);
            const row = existingRow ?? new ListingMedia();
            row.listing_id = listingId;
            if (!row.listing) {
                row.listing = { id: listingId } as Listing;
            }
            row.url = input.url;
            row.role = input.role;
            row.display_order = input.display_order ?? idx;
            row.s3_image_id = input.s3_image_id ?? row.s3_image_id ?? null;
            row.room_type_id = input.room_type_id ?? row.room_type_id ?? null;
            row.alt_text = input.alt_text ?? row.alt_text ?? null;
            toUpsert.push(row);
        });

        if (toUpsert.length > 0) {
            await repo.save(toUpsert);
            await this.attachS3Refs(em, toUpsert);
        }

        return { deletedUrls: toDelete.map((r) => r.url) };
    }

    /**
     * Best-effort link from `listing_media.s3_image_id` to a row in
     * `s3_images` by matching on URL. Doesn't throw if the link can't be
     * resolved — the URL alone is enough to render the media.
     */
    private async attachS3Refs(em: EntityManager, rows: ListingMedia[]): Promise<void> {
        const missing = rows.filter((r) => !r.s3_image_id && r.url);
        if (missing.length === 0) return;
        const urls = Array.from(new Set(missing.map((r) => r.url)));
        const s3Repo = em.getRepository(S3ImagesEntity);
        const found = await s3Repo.find({ where: { url: In(urls) } });
        if (found.length === 0) return;
        const byUrl = new Map(found.map((s) => [s.url, s.id] as const));
        const updates: ListingMedia[] = [];
        for (const row of missing) {
            const id = byUrl.get(row.url);
            if (id) {
                row.s3_image_id = id;
                updates.push(row);
            }
        }
        if (updates.length > 0) {
            await em.getRepository(ListingMedia).save(updates);
        }
    }

    /**
     * Fire-and-forget hard delete from R2 for the given URLs. Failure is
     * logged but never thrown — the database is already consistent.
     */
    async cleanupR2(urls: string[]): Promise<void> {
        if (!urls || urls.length === 0) return;
        try {
            await this.r2.deleteFileFromR2(urls);
        } catch (err) {
            logError(err as Error, "ListingMediaService R2 cleanup");
        }
    }

    /**
     * Replace ALL media for a listing (used during full delete / cascade).
     */
    async loadAllUrls(em: EntityManager, listingId: string): Promise<string[]> {
        const rows = await em.getRepository(ListingMedia).find({
            where: { listing_id: listingId },
            select: ["url"],
        });
        return rows.map((r) => r.url).filter(Boolean);
    }
}
