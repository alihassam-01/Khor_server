// ─── Querystring / Params ────────────────────────────────────────────────────

export interface IFlightSearchQuerystring {
    from: string;          // IATA code, e.g. "KDU"
    to: string;            // IATA code, e.g. "ISB"
    date: string;          // YYYY-MM-DD
    returnDate?: string;   // YYYY-MM-DD — only for round-trip
    trip?: "one-way" | "round-trip";
    seat?: "economy" | "premium-economy" | "business" | "first";
    adults?: number;
    children?: number;
    currency?: string;     // ISO 4217, e.g. "PKR"
    language?: string;     // BCP-47, e.g. "en-US"
    maxStops?: number;
    /** How many future days to populate the date-picker calendar (1–60, default 30) */
    calendarDays?: number;
}

// ─── Internal parsed model ────────────────────────────────────────────────────

export interface IFlightAirport {
    code: string;
    name: string;
}

export interface IFlightDatetime {
    date: [number, number, number]; // [year, month, day]
    time: [number, number];          // [hour, minute]
}

export interface ISingleFlightLeg {
    fromAirport: IFlightAirport;
    toAirport: IFlightAirport;
    departure: IFlightDatetime;
    arrival: IFlightDatetime;
    durationMinutes: number;
    planeType: string;
    flightNumber: string;
    airlineCode: string;
    airlineName: string;
}

export interface IFlightResult {
    type: string;
    price: number;
    currency: string;
    airlines: string[];
    legs: ISingleFlightLeg[];
    carbonEmissionGrams: number;
    typicalCarbonEmissionGrams: number;
    stops: number;
}

export interface ICalendarPricePoint {
    date: string;           // ISO date YYYY-MM-DD
    price: number | null;   // null = no flights on that day
    timestamp?: number;     // Unix ms (populated for historic points)
}

export interface IFlightSearchResult {
    results: IFlightResult[];
    lowestPrice: number | null;
    highestPrice: number | null;
    averagePrice: number | null;
    currency: string;
    airlines: IFlightAirline[];
    /** Historical price series for the past ~60 days — used for trend analysis */
    priceHistory: ICalendarPricePoint[];
    trend: "cheap" | "typical" | "expensive" | "unknown";
}

export interface IFlightAirline {
    code: string;
    name: string;
}
