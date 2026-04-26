/**
 * Legacy data migration script.
 *
 * Copies `location` + `articles` and their related data (tags, attributes,
 * category mappings, article<->location and article<->tag joins, plus the
 * s3_images entries referenced by article image_urls) from a legacy
 * (`main`-branch schema) Postgres database into the current schema.
 *
 * What is migrated:
 *   - location_categories (self-referential parent_category_id)
 *   - location              (self-referential parent_location_id)
 *   - location_attributes
 *   - location_category_mapping
 *   - tags
 *   - articles              (full row, including image_urls text[])
 *   - article_locations     (M2M join)
 *   - article_tags          (M2M join)
 *   - article_category_mappings
 *   - s3_images             (only entries whose `url` is referenced by some
 *                            article.image_urls — keeps the registry
 *                            relevant without dragging unrelated uploads in)
 *
 * What is NOT migrated:
 *   - users, user_profiles, vendors, customer_profile, address
 *   - hotels / restaurants / listings / reviews / payments / analytics
 *   - any author / vendor / user FKs
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgres://user:pass@old-host/olddb \
 *   TARGET_DATABASE_URL=postgres://user:pass@new-host/newdb \
 *   npm run migrate:legacy
 *
 *   # Dry run (only counts; no writes):
 *   npm run migrate:legacy -- --dry-run
 *
 *   # Verbose row-level logging:
 *   npm run migrate:legacy -- --verbose
 *
 * Idempotency:
 *   - All inserts use `ON CONFLICT (<pk>) DO NOTHING`, so re-running the
 *     script will not duplicate rows. PKs from the source DB are preserved.
 *   - SERIAL sequences on the target DB are reset to MAX(id) + 1 after copy
 *     so future inserts from the app don't collide with copied IDs.
 *
 * The script wraps target writes in a single transaction. If anything
 * fails, nothing is committed.
 */

import { Client, ClientConfig } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

type Args = {
    dryRun: boolean;
    verbose: boolean;
};

function parseArgs(argv: string[]): Args {
    return {
        dryRun: argv.includes("--dry-run"),
        verbose: argv.includes("--verbose") || argv.includes("-v"),
    };
}

function buildClientConfig(prefix: "SOURCE" | "TARGET"): ClientConfig {
    const url = process.env[`${prefix}_DATABASE_URL`];
    if (url) {
        return { connectionString: url };
    }
    const host = process.env[`${prefix}_DB_HOST`];
    if (!host) {
        throw new Error(
            `Missing connection config for ${prefix}. Set ${prefix}_DATABASE_URL or ${prefix}_DB_HOST/PORT/USERNAME/PASSWORD/NAME.`,
        );
    }
    return {
        host,
        port: Number(process.env[`${prefix}_DB_PORT`] ?? 5432),
        user: process.env[`${prefix}_DB_USERNAME`] ?? "postgres",
        password: process.env[`${prefix}_DB_PASSWORD`] ?? "",
        database: process.env[`${prefix}_DB_NAME`] ?? "postgres",
    };
}

type CopySpec = {
    /** Human-friendly label used in logs. */
    label: string;
    /** Source SELECT — must return columns matching `columns` in order. */
    selectSql: string;
    /** Target table (quoted-identifier-safe). */
    targetTable: string;
    /** Column names in target table, in the same order as `selectSql`. */
    columns: string[];
    /** Column(s) used by ON CONFLICT to skip duplicates. */
    conflictColumns: string[];
    /** If set, after copying we run setval on this SERIAL sequence to MAX(pk)+1. */
    sequence?: { name: string; pkColumn: string };
};

const COPY_SPECS: CopySpec[] = [
    // ---------- tags (referenced by articles via article_tags) ----------
    {
        label: "tags",
        selectSql: `SELECT tag_id, name, slug, created_at FROM "tags" ORDER BY tag_id ASC`,
        targetTable: '"tags"',
        columns: ["tag_id", "name", "slug", "created_at"],
        conflictColumns: ["tag_id"],
        sequence: { name: "tags_tag_id_seq", pkColumn: "tag_id" },
    },

    // ---------- location_categories (self-FK; ascending ID == topo order) ----------
    {
        label: "location_categories",
        selectSql: `
            SELECT category_id, name, slug, parent_category_id, created_at
            FROM "location_categories"
            ORDER BY category_id ASC
        `,
        targetTable: '"location_categories"',
        columns: ["category_id", "name", "slug", "parent_category_id", "created_at"],
        conflictColumns: ["category_id"],
        sequence: { name: "location_categories_category_id_seq", pkColumn: "category_id" },
    },

    // ---------- location (self-FK; ascending ID == topo order) ----------
    {
        label: "location",
        selectSql: `
            SELECT location_id, name, "plusCode", location_order, description,
                   is_deleted, location_type, created_at, slug, updated_at, parent_location_id
            FROM "location"
            ORDER BY location_id ASC
        `,
        targetTable: '"location"',
        columns: [
            "location_id",
            "name",
            "plusCode",
            "location_order",
            "description",
            "is_deleted",
            "location_type",
            "created_at",
            "slug",
            "updated_at",
            "parent_location_id",
        ],
        conflictColumns: ["location_id"],
        sequence: { name: "location_location_id_seq", pkColumn: "location_id" },
    },

    // ---------- location_attributes ----------
    {
        label: "location_attributes",
        selectSql: `
            SELECT attribute_id, location_id, attribute_key, attribute_value, created_at, updated_at
            FROM "location_attributes"
            ORDER BY attribute_id ASC
        `,
        targetTable: '"location_attributes"',
        columns: [
            "attribute_id",
            "location_id",
            "attribute_key",
            "attribute_value",
            "created_at",
            "updated_at",
        ],
        conflictColumns: ["attribute_id"],
        sequence: { name: "location_attributes_attribute_id_seq", pkColumn: "attribute_id" },
    },

    // ---------- location_category_mapping (composite PK) ----------
    {
        label: "location_category_mapping",
        selectSql: `
            SELECT location_id, category_id
            FROM "location_category_mapping"
        `,
        targetTable: '"location_category_mapping"',
        columns: ["location_id", "category_id"],
        conflictColumns: ["location_id", "category_id"],
    },

    // ---------- articles ----------
    {
        label: "articles",
        selectSql: `
            SELECT article_id, title, slug, excerpt, image_urls, content,
                   seo_title, seo_description, seo_keywords, is_deleted,
                   published_at, created_at, updated_at,
                   COALESCE(fulltext_index, '') AS fulltext_index
            FROM "articles"
            ORDER BY article_id ASC
        `,
        targetTable: '"articles"',
        columns: [
            "article_id",
            "title",
            "slug",
            "excerpt",
            "image_urls",
            "content",
            "seo_title",
            "seo_description",
            "seo_keywords",
            "is_deleted",
            "published_at",
            "created_at",
            "updated_at",
            "fulltext_index",
        ],
        conflictColumns: ["article_id"],
        sequence: { name: "articles_article_id_seq", pkColumn: "article_id" },
    },

    // ---------- article_locations (composite PK) ----------
    {
        label: "article_locations",
        selectSql: `SELECT article_id, location_id FROM "article_locations"`,
        targetTable: '"article_locations"',
        columns: ["article_id", "location_id"],
        conflictColumns: ["article_id", "location_id"],
    },

    // ---------- article_tags (composite PK) ----------
    {
        label: "article_tags",
        selectSql: `SELECT article_id, tag_id FROM "article_tags"`,
        targetTable: '"article_tags"',
        columns: ["article_id", "tag_id"],
        conflictColumns: ["article_id", "tag_id"],
    },

    // ---------- article_category_mappings ----------
    {
        label: "article_category_mappings",
        selectSql: `
            SELECT id, article_id, category_id
            FROM "article_category_mappings"
            ORDER BY id ASC
        `,
        targetTable: '"article_category_mappings"',
        columns: ["id", "article_id", "category_id"],
        conflictColumns: ["id"],
        sequence: { name: "article_category_mappings_id_seq", pkColumn: "id" },
    },
];

// ---------- helpers ----------

function quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
}

function buildInsertSql(spec: CopySpec, valueRowCount: number): string {
    const cols = spec.columns.map(quoteIdent).join(", ");
    const placeholderRows: string[] = [];
    let p = 1;
    for (let r = 0; r < valueRowCount; r++) {
        const row = spec.columns.map(() => `$${p++}`).join(", ");
        placeholderRows.push(`(${row})`);
    }
    const conflictCols = spec.conflictColumns.map(quoteIdent).join(", ");
    return `
        INSERT INTO ${spec.targetTable} (${cols})
        VALUES ${placeholderRows.join(", ")}
        ON CONFLICT (${conflictCols}) DO NOTHING
    `;
}

async function copyTable(
    spec: CopySpec,
    source: Client,
    target: Client,
    args: Args,
): Promise<{ read: number; inserted: number }> {
    process.stdout.write(`  • ${spec.label}: `);
    const res = await source.query(spec.selectSql);
    const rows = res.rows;
    if (rows.length === 0) {
        console.log("0 rows (skipped)");
        return { read: 0, inserted: 0 };
    }

    if (args.dryRun) {
        console.log(`${rows.length} rows (dry-run, not inserted)`);
        return { read: rows.length, inserted: 0 };
    }

    // Insert in chunks to keep parameter counts manageable. Postgres limits
    // bound parameters to 65535 per statement; we stay well under that.
    const colCount = spec.columns.length;
    const maxParams = 30000;
    const chunkSize = Math.max(1, Math.floor(maxParams / colCount));
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const sql = buildInsertSql(spec, chunk.length);
        const values: unknown[] = [];
        for (const row of chunk) {
            for (const col of spec.columns) {
                values.push(row[col]);
            }
        }
        const r = await target.query(sql, values);
        inserted += r.rowCount ?? 0;
        if (args.verbose) {
            console.log(
                `    chunk ${i / chunkSize + 1}: ${chunk.length} read, ${r.rowCount ?? 0} inserted`,
            );
        }
    }
    console.log(`${rows.length} read → ${inserted} inserted (${rows.length - inserted} already existed)`);
    return { read: rows.length, inserted };
}

async function resetSequence(target: Client, spec: CopySpec, args: Args): Promise<void> {
    if (!spec.sequence || args.dryRun) return;
    const { name, pkColumn } = spec.sequence;
    const sql = `
        SELECT setval(
            $1,
            GREATEST(
                COALESCE((SELECT MAX(${quoteIdent(pkColumn)}) FROM ${spec.targetTable}), 0),
                1
            ),
            true
        )
    `;
    await target.query(sql, [name]);
    if (args.verbose) {
        console.log(`    sequence ${name} reset to MAX(${pkColumn})`);
    }
}

async function copyReferencedS3Images(
    source: Client,
    target: Client,
    args: Args,
): Promise<{ read: number; inserted: number }> {
    process.stdout.write("  • s3_images (article-referenced only): ");
    // Collect all URLs referenced by article.image_urls on the SOURCE side.
    const urlRes = await source.query(`
        SELECT DISTINCT url
        FROM (
            SELECT unnest(image_urls) AS url FROM "articles"
        ) t
        WHERE url IS NOT NULL AND url <> ''
    `);
    const urls = urlRes.rows.map((r: { url: string }) => r.url);
    if (urls.length === 0) {
        console.log("0 referenced URLs (skipped)");
        return { read: 0, inserted: 0 };
    }

    const imgRes = await source.query(
        `SELECT id, key, url, "dateUploaded", hash, "isDeleted"
         FROM "s3_images"
         WHERE url = ANY($1::text[])`,
        [urls],
    );
    const rows = imgRes.rows;
    if (rows.length === 0) {
        console.log(`${urls.length} URLs referenced, 0 matching s3_images rows`);
        return { read: 0, inserted: 0 };
    }

    if (args.dryRun) {
        console.log(`${rows.length} matching rows (dry-run, not inserted)`);
        return { read: rows.length, inserted: 0 };
    }

    const cols = ["id", "key", "url", "dateUploaded", "hash", "isDeleted"];
    const maxParams = 30000;
    const chunkSize = Math.max(1, Math.floor(maxParams / cols.length));
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const placeholderRows: string[] = [];
        const values: unknown[] = [];
        let p = 1;
        for (const row of chunk) {
            const slots: string[] = [];
            for (const col of cols) {
                slots.push(`$${p++}`);
                values.push(row[col]);
            }
            placeholderRows.push(`(${slots.join(", ")})`);
        }
        const sql = `
            INSERT INTO "s3_images" (${cols.map(quoteIdent).join(", ")})
            VALUES ${placeholderRows.join(", ")}
            ON CONFLICT (id) DO NOTHING
        `;
        const r = await target.query(sql, values);
        inserted += r.rowCount ?? 0;
    }
    console.log(`${rows.length} read → ${inserted} inserted (${rows.length - inserted} already existed)`);
    return { read: rows.length, inserted };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    console.log("Legacy → new schema migration");
    console.log("=============================");
    if (args.dryRun) console.log("Mode: DRY RUN (no writes will be committed)");

    const source = new Client(buildClientConfig("SOURCE"));
    const target = new Client(buildClientConfig("TARGET"));
    await source.connect();
    await target.connect();

    // Sanity check: target must be a schema we recognise.
    const check = await target.query(
        `SELECT to_regclass('public."articles"') AS articles, to_regclass('public."location"') AS location`,
    );
    if (!check.rows[0].articles || !check.rows[0].location) {
        throw new Error(
            "Target database is missing `articles` or `location` tables. Run `npm run migration:run` first.",
        );
    }

    const totals: Record<string, { read: number; inserted: number }> = {};

    try {
        await target.query("BEGIN");

        // Defer FK checks within the transaction is not possible unless the FKs
        // are DEFERRABLE — ours aren't — but the order in COPY_SPECS already
        // satisfies dependencies, so straight-line execution is fine.
        for (const spec of COPY_SPECS) {
            const result = await copyTable(spec, source, target, args);
            totals[spec.label] = result;
        }

        const s3 = await copyReferencedS3Images(source, target, args);
        totals["s3_images"] = s3;

        if (!args.dryRun) {
            // Reset sequences after rows are inserted but before commit so that
            // a failure here still rolls back cleanly.
            console.log("Resetting SERIAL sequences…");
            for (const spec of COPY_SPECS) {
                await resetSequence(target, spec, args);
            }
        }

        if (args.dryRun) {
            await target.query("ROLLBACK");
            console.log("\nDRY RUN complete — rolled back.");
        } else {
            await target.query("COMMIT");
            console.log("\nMigration committed.");
        }
    } catch (err) {
        await target.query("ROLLBACK").catch(() => undefined);
        throw err;
    } finally {
        await source.end();
        await target.end();
    }

    // Summary table.
    console.log("\nSummary");
    console.log("-------");
    console.log("table".padEnd(32), "read".padStart(8), "inserted".padStart(10));
    for (const [label, { read, inserted }] of Object.entries(totals)) {
        console.log(label.padEnd(32), String(read).padStart(8), String(inserted).padStart(10));
    }
}

main().catch((err) => {
    console.error("\nMigration failed:", err);
    process.exit(1);
});
