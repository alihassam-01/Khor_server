import { FastifyRequest, FastifyReply } from "fastify";
import { LocationService } from "../service/location.service";

export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  async createLocation(
    req: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const location = await this.locationService.createLocation(req.body);
      reply.code(201).send(location);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getLocationById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const location = await this.locationService.getLocationById(Number(req.params.id));
      if (!location) {
        return reply.code(404).send({ message: "Location not found" });
      }
      reply.send(location);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getLocationBySlug(
    req: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) {
    try {
      const location = await this.locationService.getLocationBySlug(req.params.slug);
      if (!location) {
        return reply.code(404).send({ message: "Location not found" });
      }
      reply.send(location);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async updateLocation(
    req: FastifyRequest<{ Params: { id: string }; Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const updated = await this.locationService.updateLocation(Number(req.params.id), req.body);
      if (!updated) {
        return reply.code(404).send({ message: "Location not found" });
      }
      reply.send(updated);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async deleteLocation(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const success = await this.locationService.deleteLocation(Number(req.params.id));
      if (!success) {
        return reply.code(404).send({ message: "Location not found" });
      }
      reply.send({ message: "Location deleted successfully" });
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getAllLocations(_: FastifyRequest, reply: FastifyReply) {
    try {
      const locations = await this.locationService.getAllLocations();
      reply.send(locations);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  private handleError(error: any, reply: FastifyReply) {
    let parsedError = { message: "Something went wrong", code: "UNKNOWN_ERROR" };

    try {
      parsedError = JSON.parse(error.message);
    } catch (_) {
      parsedError.message = error.message;
    }

    reply.code(400).send(parsedError);
  }
}
