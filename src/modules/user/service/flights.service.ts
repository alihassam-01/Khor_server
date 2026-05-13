import https from "https";
import http from "http";
import zlib from "zlib";
import { URL } from "url";
import {
    IFlightSearchQuerystring,
    IFlightSearchResult,
    IFlightResult,
    IFlightAirline,
    ICalendarPricePoint,
    ISingleFlightLeg,
    IFlightAirport,
    IFlightDatetime,
} from "@modules/user/types/flights.types";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

// ──────────────────────────────────────────────────────────────────────────────
// Protobuf field tag helpers (wire types)
// We hand-craft a minimal protobuf encoder so we have zero external deps.
// The Flights service uses a specific proto schema for the `tfs` query param.
//
// Schema (from fast-flights/flights.proto):
//   message Airport   { string airport = 2; }
//   message FlightData { string date = 2; Airport from_airport = 13; Airport to_airport = 14;
//                        optional int32 max_stops = 5; }
//   message Info      { repeated FlightData data = 3; Seat seat = 9;
//                        repeated Passenger passengers = 8; Trip trip = 19; }
//
// Enum values:
//   Seat: ECONOMY=1, PREMIUM_ECONOMY=2, BUSINESS=3, FIRST=4
//   Trip: ROUND_TRIP=1, ONE_WAY=2, MULTI_CITY=3
//   Passenger: ADULT=1, CHILD=2
// ──────────────────────────────────────────────────────────────────────────────

const WIRE_VARINT = 0;
const WIRE_LENGTH_DELIM = 2;

function makeTag(fieldNumber: number, wireType: number): number {
    return (fieldNumber << 3) | wireType;
}

function encodeVarint(value: number): Buffer {
    const bytes: number[] = [];
    let v = value >>> 0; // treat as unsigned
    while (v > 0x7f) {
        bytes.push((v & 0x7f) | 0x80);
        v = v >>> 7;
    }
    bytes.push(v & 0x7f);
    return Buffer.from(bytes);
}

function encodeLengthDelimited(data: Buffer): Buffer {
    return Buffer.concat([encodeVarint(data.length), data]);
}

function encodeField(fieldNumber: number, wireType: number, data: Buffer): Buffer {
    return Buffer.concat([encodeVarint(makeTag(fieldNumber, wireType)), data]);
}

function encodeStringField(fieldNumber: number, value: string): Buffer {
    const strBuf = Buffer.from(value, "utf8");
    return encodeField(fieldNumber, WIRE_LENGTH_DELIM, encodeLengthDelimited(strBuf));
}

function encodeVarintField(fieldNumber: number, value: number): Buffer {
    return encodeField(fieldNumber, WIRE_VARINT, encodeVarint(value));
}

function encodeMessageField(fieldNumber: number, messageBuf: Buffer): Buffer {
    return encodeField(fieldNumber, WIRE_LENGTH_DELIM, encodeLengthDelimited(messageBuf));
}

/** Encode Airport { airport = 2 } */
function encodeAirport(iataCode: string): Buffer {
    return encodeStringField(2, iataCode);
}

/** Encode FlightData { date=2, from_airport=13, to_airport=14, max_stops=5 } */
function encodeFlightData(
    date: string,
    fromIata: string,
    toIata: string,
    maxStops?: number
): Buffer {
    const parts: Buffer[] = [
        encodeStringField(2, date),
        encodeMessageField(13, encodeAirport(fromIata)),
        encodeMessageField(14, encodeAirport(toIata)),
    ];
    if (maxStops !== undefined && maxStops !== null) {
        parts.push(encodeVarintField(5, maxStops));
    }
    return Buffer.concat(parts);
}

/** Encode Passenger repeated field (field 8) */
function encodePassengers(adults: number, children: number): Buffer {
    const ADULT_ENUM = 1;
    const CHILD_ENUM = 2;
    const parts: Buffer[] = [];
    for (let i = 0; i < adults; i++) parts.push(encodeVarintField(8, ADULT_ENUM));
    for (let i = 0; i < children; i++) parts.push(encodeVarintField(8, CHILD_ENUM));
    return Buffer.concat(parts);
}

const SEAT_MAP: Record<string, number> = {
    "economy": 1,
    "premium-economy": 2,
    "business": 3,
    "first": 4,
};

const TRIP_MAP: Record<string, number> = {
    "round-trip": 1,
    "one-way": 2,
};

/**
 * Build the base64-encoded protobuf `tfs` param consumed by the Flights service.
 */
function buildTfsParam(opts: IFlightSearchQuerystring): string {
    const seat = SEAT_MAP[opts.seat ?? "economy"] ?? 1;
    const trip = TRIP_MAP[opts.trip ?? "one-way"] ?? 2;
    const adults = Math.max(1, opts.adults ?? 1);
    const children = opts.children ?? 0;

    const flightDatas: Buffer[] = [
        encodeMessageField(
            3,
            encodeFlightData(opts.date, opts.from, opts.to, opts.maxStops)
        ),
    ];

    // For round-trips a second FlightData leg is appended (return journey)
    if (opts.trip === "round-trip" && opts.returnDate) {
        flightDatas.push(
            encodeMessageField(
                3,
                encodeFlightData(opts.returnDate, opts.to, opts.from, opts.maxStops)
            )
        );
    }

    const infoBuf = Buffer.concat([
        ...flightDatas,
        encodeVarintField(9, seat),
        encodePassengers(adults, children),
        encodeVarintField(19, trip),
    ]);

    return infoBuf.toString("base64url");
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP fetcher (Node.js built-in https — no external dep)
// ──────────────────────────────────────────────────────────────────────────────

const GOOGLE_FLIGHTS_URL = "https://www.google.com/travel/flights";

/** Perform an HTTPS GET and return the raw HTML body. */
function fetchUrl(urlStr: string, redirectCount = 0): Promise<string> {
    if (redirectCount > 5) {
        return Promise.reject(
            new AppError("Too many redirects from Flights service", 502, ErrorCodes.INTERNAL_SERVER_ERROR)
        );
    }

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlStr);
        const options: http.RequestOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/124.0.0.0 Safari/537.36",
                Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                // Explicitly request gzip so we can decompress with zlib
                "Accept-Encoding": "gzip, deflate",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Upgrade-Insecure-Requests": "1",
            },
        };

        const req = https.get(options, (res) => {
            // Follow redirects
            if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                const next = res.headers.location.startsWith("http")
                    ? res.headers.location
                    : `https://${parsedUrl.hostname}${res.headers.location}`;
                res.resume(); // drain the response
                resolve(fetchUrl(next, redirectCount + 1));
                return;
            }

            if (!res.statusCode || res.statusCode >= 400) {
                res.resume();
                reject(
                    new AppError(
                        `Flights fetch failed: HTTP ${res.statusCode}`,
                        502,
                        ErrorCodes.INTERNAL_SERVER_ERROR
                    )
                );
                return;
            }

            // Decompress response based on Content-Encoding
            const encoding = res.headers["content-encoding"];
            let stream: NodeJS.ReadableStream = res;

            if (encoding === "gzip") {
                stream = res.pipe(zlib.createGunzip());
            } else if (encoding === "deflate") {
                stream = res.pipe(zlib.createInflate());
            } else if (encoding === "br") {
                stream = res.pipe(zlib.createBrotliDecompress());
            }

            const chunks: Buffer[] = [];
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            stream.on("error", (err) => reject(err));
        });

        req.on("error", (err) => reject(err));
        req.setTimeout(20000, () => {
            req.destroy();
            reject(
                new AppError(
                    "Flights request timed out",
                    504,
                    ErrorCodes.INTERNAL_SERVER_ERROR
                )
            );
        });
    });
}

/**
 * Fetch the raw Flights HTML for the given search parameters.
 * Builds the `tfs` protobuf param and appends `hl` + `curr` query strings.
 */
async function fetchFlightsHtml(opts: IFlightSearchQuerystring): Promise<string> {
    const tfs = buildTfsParam(opts);
    const currency = opts.currency ?? "PKR";
    const language = opts.language ?? "en-US";

    const url =
        `${GOOGLE_FLIGHTS_URL}?tfs=${encodeURIComponent(tfs)}` +
        `&hl=${encodeURIComponent(language)}` +
        `&curr=${encodeURIComponent(currency)}`;

    return fetchUrl(url);
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML → payload parser
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract the inline JS data payload from the Flights HTML page.
 * The provider embeds the flight data as `data: [...]` inside a <script class="ds:1"> tag.
 */
function extractPayload(html: string): unknown[] | null {
    // Match the script tag content
    const scriptMatch = html.match(
        /<script[^>]+class="[^"]*ds:1[^"]*"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!scriptMatch) return null;

    const scriptContent = scriptMatch[1];

    // Extract the data: [...] portion
    const dataMatch = scriptContent.match(/data:([\s\S]+),\s*sideChannel:/);
    if (!dataMatch) return null;

    try {
        return JSON.parse(dataMatch[1]) as unknown[];
    } catch {
        return null;
    }
}

/** Convert timestamp (ms since epoch) to ISO date string (YYYY-MM-DD). */
function tsToDate(ts: number): string {
    return new Date(ts).toISOString().slice(0, 10);
}


function safeArray(val: unknown): unknown[] {
    return Array.isArray(val) ? val : [];
}

/**
 * Parse the raw Flights JSON payload into our strongly-typed result shape.
 *
 * Payload indices (discovered by @kftang & verified against live responses):
 *   payload[3][0]     → list of flight offers
 *   payload[5]        → price metadata
 *     [5][1]          → [null, currentLowest]
 *     [5][2]          → [null, averagePrice]
 *     [5][10]         → [[ts, price], ...] calendar price series
 *   payload[7][1][0]  → alliances [[code, name], ...]
 *   payload[7][1][1]  → airlines  [[code, name], ...]
 */
function parsePayload(
    payload: unknown[],
    currency: string
): Omit<IFlightSearchResult, "trend" | "futureCalendar"> & { rawLowest: number | null; rawTypical: number | null } {
    // ── Airlines ──────────────────────────────────────────────────────────────
    const airlines: IFlightAirline[] = [];
    try {
        const p7 = safeArray(payload[7]);
        const p71 = safeArray(p7[1]);
        const airlinesData = safeArray(p71[1]);
        for (const entry of airlinesData) {
            const [code, name] = safeArray(entry) as [string, string];
            if (code && name) airlines.push({ code, name });
        }
    } catch {
        // non-fatal
    }

    // ── Historical price series (past ~60 days, used for trend analysis) ──────
    const priceHistory: ICalendarPricePoint[] = [];
    try {
        const priceMeta = safeArray(payload[5]);
        const calSeries = safeArray(safeArray(priceMeta[10])[0]);
        for (const point of calSeries) {
            const [ts, price] = safeArray(point) as [number, number];
            if (typeof ts === "number" && typeof price === "number") {
                priceHistory.push({ date: tsToDate(ts), timestamp: ts, price });
            }
        }
    } catch {
        // non-fatal
    }

    // ── Lowest / average price hints ─────────────────────────────────────────
    let rawLowest: number | null = null;
    let rawTypical: number | null = null;
    try {
        const priceMeta = safeArray(payload[5]);
        rawLowest  = (safeArray(priceMeta[1])[1] as number) ?? null;
        rawTypical = (safeArray(priceMeta[2])[1] as number) ?? null;
    } catch {
        // non-fatal
    }

    // ── Flight results ────────────────────────────────────────────────────────
    const results: IFlightResult[] = [];
    const offers = safeArray((payload[3] as unknown[])?.[0]);

    for (const offer of offers) {
        try {
            const offerArr = safeArray(offer);
            const flight = safeArray(offerArr[0]);
            const priceEntry = safeArray(safeArray(offerArr[1])?.[0]);

            // Price can be in priceEntry[1] (raw number) or sometimes priceEntry[0]
            let price = (priceEntry[1] as number) ?? (priceEntry[0] as number) ?? 0;
            
            // If price is still 0, try to find any number in priceEntry
            if (!price) {
                const foundPrice = priceEntry.find(val => typeof val === 'number' && val > 0);
                if (foundPrice) price = foundPrice as number;
            }
            const type = (flight[0] as string) ?? "unknown";
            const airlineCodes = safeArray(flight[1]) as string[];

            const legs: ISingleFlightLeg[] = [];
            const flightLegs = safeArray(flight[2]);

            for (const leg of flightLegs) {
                const legArr = safeArray(leg);

                const fromAirport: IFlightAirport = {
                    code: (legArr[3] as string) ?? "",
                    name: (legArr[4] as string) ?? "",
                };
                const toAirport: IFlightAirport = {
                    code: (legArr[6] as string) ?? "",
                    name: (legArr[5] as string) ?? "",
                };

                const departureTime = safeArray(legArr[8]) as [number, number];
                const departureDate = safeArray(legArr[20]) as [number, number, number];
                const departure: IFlightDatetime = { date: departureDate, time: departureTime };

                const arrivalTime = safeArray(legArr[10]) as [number, number];
                const arrivalDate = safeArray(legArr[21]) as [number, number, number];
                const arrival: IFlightDatetime = { date: arrivalDate, time: arrivalTime };

                const durationMinutes = (legArr[11] as number) ?? 0;
                const planeType = (legArr[17] as string) ?? (legArr[24] as string) ?? "";

                // Flight number metadata is often in legArr[22] = [airlineCode, flightNum, ?, airlineName]
                // Fallback to legArr[23] or legArr[18]
                const legMeta = safeArray(legArr[22]) || safeArray(legArr[23]) || safeArray(legArr[18]);
                const airlineCode = (legMeta[0] as string) ?? (legArr[23] as string) ?? "";
                const flightNumber = (legMeta[1] as string) ?? "";
                const airlineName = (legMeta[3] as string) ?? (legArr[18] as string) ?? "";

                legs.push({
                    fromAirport,
                    toAirport,
                    departure,
                    arrival,
                    durationMinutes,
                    planeType,
                    flightNumber,
                    airlineCode,
                    airlineName,
                });
            }

            // Carbon data is in flight[22] (extras block)
            const extras = safeArray(flight[22]);
            const carbonEmissionGrams = (extras[7] as number) ?? 0;
            const typicalCarbonEmissionGrams = (extras[8] as number) ?? 0;

            const stops = Math.max(0, legs.length - 1);

            results.push({
                type,
                price,
                currency,
                airlines: airlineCodes,
                legs,
                carbonEmissionGrams,
                typicalCarbonEmissionGrams,
                stops,
            });
        } catch {
            // Skip malformed entries
        }
    }

    // ── Aggregate stats ───────────────────────────────────────────────────────
    const prices = results.map((r) => r.price).filter((p) => p > 0);
    const lowestPrice = prices.length ? Math.min(...prices) : null;
    const highestPrice = prices.length ? Math.max(...prices) : null;
    const averagePrice = prices.length
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null;

    return {
        results,
        lowestPrice,
        highestPrice,
        averagePrice,
        currency,
        airlines,
        priceHistory,
        rawLowest,
        rawTypical,
    };
}

/**
 * Derive a price-trend label by comparing the lowest found price against
 * the "typical" price hint embedded in the payload.
 *
 * Buckets (heuristic):
 *   < 85% of typical  → "cheap"
 *   85–115% of typical → "typical"
 *   > 115% of typical  → "expensive"
 */
function deriveTrend(
    lowestPrice: number | null,
    rawTypical: number | null
): IFlightSearchResult["trend"] {
    if (!lowestPrice || !rawTypical || rawTypical <= 0) return "unknown";
    const ratio = lowestPrice / rawTypical;
    if (ratio < 0.85) return "cheap";
    if (ratio <= 1.15) return "typical";
    return "expensive";
}

// ──────────────────────────────────────────────────────────────────────────────────
// Future calendar fetcher
// ──────────────────────────────────────────────────────────────────────────────────

/**
 * Adds N calendar days to a YYYY-MM-DD string. Fast, pure arithmetic.
 */
function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * Lightweight single-page fetch that only extracts the hinted lowest
 * price for one route+date combo (payload[5][1][1]).
 *
 * The service always includes a "best price" hint even if the page has no visible
 * offers for that specific date. Returns null if the page can’t be parsed or
 * has no price data.
 */
async function fetchLowestPriceForDate(
    opts: IFlightSearchQuerystring,
    date: string
): Promise<number | null> {
    const singleDateOpts = { ...opts, date };
    try {
        const html = await fetchFlightsHtml(singleDateOpts);
        const payload = extractPayload(html);
        if (!payload) return null;

        // Fast path: use embedded price hint (payload[5][1][1])
        const priceMeta = safeArray(payload[5]);
        const hintedLowest = safeArray(priceMeta[1])[1];
        if (typeof hintedLowest === "number" && hintedLowest > 0) {
            return hintedLowest;
        }

        // Fallback: extract lowest from actual offer list
        const offers = safeArray((payload[3] as unknown[])?.[0]);
        const prices: number[] = [];
        for (const offer of offers) {
            try {
                const offerArr = safeArray(offer);
                const priceEntry = safeArray(safeArray(offerArr[1])?.[0]);
                const p = priceEntry[1] as number;
                if (typeof p === "number" && p > 0) prices.push(p);
            } catch { /* skip */ }
        }
        return prices.length ? Math.min(...prices) : null;
    } catch {
        return null; // network errors are non-fatal for calendar points
    }
}

/**
 * Fetch lowest prices for the next `days` calendar days, starting from
 * `startDate` (inclusive). Requests are batched in groups of BATCH_SIZE
 * to avoid overwhelming the provider's servers.
 *
 * Returns an array of { date, price } in ascending date order.
 */
const CALENDAR_BATCH_SIZE = 5; // concurrent requests per batch

async function fetchFutureCalendar(
    opts: IFlightSearchQuerystring,
    startDate: string,
    days: number
): Promise<ICalendarPricePoint[]> {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
        dates.push(addDays(startDate, i));
    }

    const results: ICalendarPricePoint[] = [];

    // Process in batches
    for (let i = 0; i < dates.length; i += CALENDAR_BATCH_SIZE) {
        const batch = dates.slice(i, i + CALENDAR_BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (date) => {
                const price = await fetchLowestPriceForDate(opts, date);
                return { date, price } as ICalendarPricePoint;
            })
        );
        results.push(...batchResults);
        // Small delay between batches to be polite to the service
        if (i + CALENDAR_BATCH_SIZE < dates.length) {
            await new Promise((r) => setTimeout(r, 300));
        }
    }

    return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Service class
// ──────────────────────────────────────────────────────────────────────────────

export class FlightsService {
    /**
     * Search for flights and return structured flight data including:
     * - available flight results with legs, prices and airline info
     * - lowest / highest / average price across results
     * - priceHistory: past ~60 days of pricing (used for trend signal)
     * - futureCalendar: one min-price entry per day for the next calendarDays days
     *   (this is exactly what the date-picker calendar grid shows)
     * - price trend label (cheap / typical / expensive)
     * - list of operating airlines on the route
     */
    async searchFlights(opts: IFlightSearchQuerystring): Promise<IFlightSearchResult> {
        const currency = opts.currency ?? "PKR";

        // ── 1. Fetch the main search page for the requested date ──────────────
        let html: string;
        try {
            html = await fetchFlightsHtml(opts);
        } catch (err) {
            if (err instanceof AppError) throw err;
            throw new AppError(
                "Failed to fetch flight data from provider",
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR
            );
        }

        const payload = extractPayload(html);
        if (!payload) {
            throw new AppError(
                "Unable to parse Flights response. The page structure may have changed.",
                502,
                ErrorCodes.INTERNAL_SERVER_ERROR
            );
        }

        const parsed = parsePayload(payload, currency);
        const trend = deriveTrend(parsed.lowestPrice, parsed.rawTypical);

        return {
            results: parsed.results,
            lowestPrice: parsed.lowestPrice,
            highestPrice: parsed.highestPrice,
            averagePrice: parsed.averagePrice,
            currency: parsed.currency,
            airlines: parsed.airlines,
            priceHistory: parsed.priceHistory,
            trend,
        };
    }

    /**
     * Optimized calendar fetcher using BatchExecute RPC.
     * Falls back to parallel fetcher if BatchExecute fails.
     */
    async searchCalendar(opts: IFlightSearchQuerystring): Promise<ICalendarPricePoint[]> {
        const calDays = Math.min(Math.max(opts.calendarDays ?? 60, 1), 90);
        
        try {
            return await this.fetchCalendarBatchExecute(opts);
        } catch (err) {
            console.warn("BatchExecute failed, falling back to parallel fetcher:", err);
            return await fetchFutureCalendar(opts, opts.date, calDays);
        }
    }

    private async fetchCalendarBatchExecute(opts: IFlightSearchQuerystring): Promise<ICalendarPricePoint[]> {
        const tfs = buildTfsParam(opts);
        const rpcId = "v9S8zd";
        const seatCode = SEAT_MAP[opts.seat ?? "economy"] ?? 1;
        
        // Inner request structure for v9S8zd
        const innerReq = [null, tfs, null, null, null, null, null, [seatCode]];
        const fReq = [[[ rpcId, JSON.stringify(innerReq), null, "1" ]]];
        const postData = `f.req=${encodeURIComponent(JSON.stringify(fReq))}`;
        
        const url = `https://www.google.com/_/TravelFrontendUi/data/batchexecute?rpcids=${rpcId}&hl=${opts.language || "en-US"}&curr=${opts.currency || "PKR"}`;

        const response: string = await new Promise((resolve, reject) => {
            const req = https.request(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
            }, (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => resolve(data));
            });
            req.on("error", reject);
            req.write(postData);
            req.end();
        });

        if (response.includes("er") && response.length < 500) {
             throw new Error("BatchExecute returned error");
        }

        const lines = response.split("\n");
        const dataLine = lines.find(l => l.includes(rpcId));
        if (!dataLine) throw new Error("No data line in BatchExecute response");
        
        const outer = JSON.parse(dataLine);
        const innerJsonStr = outer[0][2];
        const inner = JSON.parse(innerJsonStr);
        
        const priceGrid = inner[1];
        if (!Array.isArray(priceGrid)) throw new Error("Invalid price grid structure");

        return priceGrid.map((p: any) => ({
            date: p[0],
            price: p[1]?.[0]?.[0] || null
        }));
    }
}
