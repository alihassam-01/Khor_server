export interface IFlightSearchResponseDto {
    results: IFlightResultDto[];
    lowestPrice: number | null;
    highestPrice: number | null;
    averagePrice: number | null;
    currency: string;
    airlines: IFlightAirlineDto[];
    priceHistory: ICalendarPricePointDto[];
    trend: "cheap" | "typical" | "expensive" | "unknown";
}

export interface IFlightCalendarResponseDto {
    futureCalendar: ICalendarPricePointDto[];
}

export interface IFlightResultDto {
    type: string;
    price: number;
    currency: string;
    airlines: string[];
    legs: IFlightLegDto[];
    carbonEmissionGrams: number;
    typicalCarbonEmissionGrams: number;
    stops: number;
}

export interface IFlightLegDto {
    fromAirport: IFlightAirportDto;
    toAirport: IFlightAirportDto;
    departure: IFlightDatetimeDto;
    arrival: IFlightDatetimeDto;
    durationMinutes: number;
    planeType: string;
    flightNumber: string;
    airlineCode: string;
    airlineName: string;
}

export interface IFlightAirportDto {
    code: string;
    name: string;
}

export interface IFlightDatetimeDto {
    date: [number, number, number];
    time: [number, number];
    iso: string;
}

export interface IFlightAirlineDto {
    code: string;
    name: string;
}

export interface ICalendarPricePointDto {
    date: string;
    price: number | null;
    timestamp?: number;
}
