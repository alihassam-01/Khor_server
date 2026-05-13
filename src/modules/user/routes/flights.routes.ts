import { FastifyInstance } from "fastify";
import { FlightsService } from "@modules/user/service/flights.service";
import { FlightsController } from "@modules/user/controller/flights.controller";
import { flightSearchSchema, flightCalendarSchema } from "@modules/user/schemas/flights.schema";

export async function flightsRoutes(fastify: FastifyInstance) {
    const flightsService = new FlightsService();
    const flightsController = new FlightsController(flightsService);

    /**
     * GET /api/flights/search
     * Primary flight search endpoint. Fast and returns real-time offers.
     */
    fastify.get(
        "/flights/search",
        { schema: flightSearchSchema },
        flightsController.search.bind(flightsController)
    );

    /**
     * GET /api/flights/calendar
     * Specialized endpoint for the calendar/date-picker view.
     * Uses optimized BatchExecute API to get 2 months of prices in one go.
     */
    fastify.get(
        "/flights/calendar",
        { schema: flightCalendarSchema },
        flightsController.calendar.bind(flightsController)
    );
}
