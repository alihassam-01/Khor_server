import { FastifyRequest, FastifyReply } from "fastify";
import { FlightsService } from "@modules/user/service/flights.service";
import { IFlightSearchQuerystring } from "@modules/user/types/flights.types";
import {
    IFlightSearchResponseDto,
    IFlightCalendarResponseDto,
    IFlightResultDto,
    IFlightLegDto,
    ICalendarPricePointDto,
} from "@modules/user/dtos/flights.dto";
import { IFlightSearchResult, ISingleFlightLeg, ICalendarPricePoint } from "@modules/user/types/flights.types";

function buildIsoString(
    date: [number, number, number],
    time: [number, number]
): string {
    const [y, m, d] = date;
    const [h, min] = time;
    return (
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` +
        `T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
    );
}

function mapLegToDto(leg: ISingleFlightLeg): IFlightLegDto {
    return {
        fromAirport: leg.fromAirport,
        toAirport: leg.toAirport,
        departure: {
            date: leg.departure.date,
            time: leg.departure.time,
            iso: buildIsoString(leg.departure.date, leg.departure.time),
        },
        arrival: {
            date: leg.arrival.date,
            time: leg.arrival.time,
            iso: buildIsoString(leg.arrival.date, leg.arrival.time),
        },
        durationMinutes: leg.durationMinutes,
        planeType: leg.planeType,
        flightNumber: leg.flightNumber,
        airlineCode: leg.airlineCode,
        airlineName: leg.airlineName,
    };
}

function mapCalendarPointToDto(point: ICalendarPricePoint): ICalendarPricePointDto {
    return {
        date: point.date,
        price: point.price,
        timestamp: point.timestamp,
    };
}

function mapResultToDto(
    result: IFlightSearchResult["results"][number]
): IFlightResultDto {
    return {
        type: result.type,
        price: result.price,
        currency: result.currency,
        airlines: result.airlines,
        legs: result.legs.map(mapLegToDto),
        carbonEmissionGrams: result.carbonEmissionGrams,
        typicalCarbonEmissionGrams: result.typicalCarbonEmissionGrams,
        stops: result.stops,
    };
}

export class FlightsController {
    constructor(private readonly flightsService: FlightsService) {}

    async search(
        req: FastifyRequest<{ Querystring: IFlightSearchQuerystring }>,
        reply: FastifyReply
    ) {
        const searchResult = await this.flightsService.searchFlights(req.query);

        const response: IFlightSearchResponseDto = {
            results: searchResult.results.map(mapResultToDto),
            lowestPrice: searchResult.lowestPrice,
            highestPrice: searchResult.highestPrice,
            averagePrice: searchResult.averagePrice,
            currency: searchResult.currency,
            airlines: searchResult.airlines,
            priceHistory: searchResult.priceHistory.map(mapCalendarPointToDto),
            trend: searchResult.trend,
        };

        reply.send(response);
    }

    async calendar(
        req: FastifyRequest<{ Querystring: IFlightSearchQuerystring }>,
        reply: FastifyReply
    ) {
        const calendarPoints = await this.flightsService.searchCalendar(req.query);

        const response: IFlightCalendarResponseDto = {
            futureCalendar: calendarPoints.map(mapCalendarPointToDto),
        };

        reply.send(response);
    }
}
