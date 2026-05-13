// Fastify JSON-Schema for GET /flights/search
const calendarPricePointSchema = {
    type: "object",
    properties: {
        date:      { type: "string", description: "ISO date YYYY-MM-DD" },
        price:     { description: "Minimum price for that date, or null if unavailable", oneOf: [{ type: "number" }, { type: "null" }] },
        timestamp: { type: "number", description: "Unix epoch milliseconds (populated for historical points)" },
    },
};

export const flightSearchSchema = {
    tags: ["Flights"],
    summary: "Search for flights",
    description:
        "Fetches flight prices, trends, calendar data and airline information from the provider. " +
        "Returns `priceHistory` (past ~60 days) for trend analysis and `futureCalendar` with the minimum " +
        "price per day for the next `calendarDays` days — exactly what the date-picker calendar shows.",
    querystring: {
        type: "object",
        required: ["from", "to", "date"],
        properties: {
            from:         { type: "string", minLength: 3, maxLength: 4,  description: "Origin IATA airport code (e.g. LHR)" },
            to:           { type: "string", minLength: 3, maxLength: 4,  description: "Destination IATA airport code (e.g. ISB)" },
            date:         { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Departure date YYYY-MM-DD" },
            returnDate:   { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Return date YYYY-MM-DD (round-trip only)" },
            trip:         { type: "string", enum: ["one-way", "round-trip"], default: "one-way" },
            seat:         { type: "string", enum: ["economy", "premium-economy", "business", "first"], default: "economy" },
            adults:       { type: "integer", minimum: 1, maximum: 9, default: 1 },
            children:     { type: "integer", minimum: 0, maximum: 8, default: 0 },
            currency:     { type: "string", minLength: 3, maxLength: 3, default: "PKR", description: "ISO 4217 currency code" },
            language:     { type: "string", default: "en-US", description: "BCP-47 language tag" },
            maxStops:     { type: "integer", minimum: 0, maximum: 3 },
            calendarDays: {
                type: "integer", minimum: 1, maximum: 60, default: 30,
                description: "Number of future days to include in the date-picker calendar grid (1–60, default 30)",
            },
        },
        additionalProperties: false,
    },
    response: {
        200: {
            type: "object",
            properties: {
                results:       { type: "array",  items: { type: "object", additionalProperties: true } },
                lowestPrice:   { oneOf: [{ type: "number" }, { type: "null" }] },
                highestPrice:  { oneOf: [{ type: "number" }, { type: "null" }] },
                averagePrice:  { oneOf: [{ type: "number" }, { type: "null" }] },
                currency:      { type: "string" },
                airlines:      { type: "array", items: { type: "object", properties: { code: { type: "string" }, name: { type: "string" } } } },
                trend:         { type: "string", enum: ["cheap", "typical", "expensive", "unknown"] },
                priceHistory:  { type: "array", items: calendarPricePointSchema, description: "Historical prices for past ~60 days" },
            },
        },
    },
};

export const flightCalendarSchema = {
    tags: ["Flights"],
    summary: "Get future calendar prices for a flight route",
    description: "Fetches min price per day for the next `calendarDays` days using optimized BatchExecute API.",
    querystring: {
        type: "object",
        required: ["from", "to", "date"],
        properties: {
            from:         { type: "string", minLength: 3, maxLength: 4,  description: "Origin IATA airport code" },
            to:           { type: "string", minLength: 3, maxLength: 4,  description: "Destination IATA airport code" },
            date:         { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Departure date YYYY-MM-DD" },
            currency:     { type: "string", minLength: 3, maxLength: 3, default: "PKR" },
            seat:         { type: "string", enum: ["economy", "premium-economy", "business", "first"], default: "economy" },
            calendarDays: { type: "integer", minimum: 1, maximum: 90, default: 60 },
        },
        additionalProperties: false,
    },
    response: {
        200: {
            type: "object",
            properties: {
                futureCalendar: { type: "array", items: calendarPricePointSchema },
            },
        },
    },
};
