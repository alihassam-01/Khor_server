import { FastifyReply, FastifyRequest } from "fastify";
import { TourPackageService } from "@modules/user/service";
import { TourPackage } from "@entity/property";
import { TourPackageReceiveDTO } from "../dtos/tourpackage.dto";

export class TourPackageController {
  constructor(private readonly tourPackageService: TourPackageService) {}

  async create(
    req: FastifyRequest<{
      Body: TourPackageReceiveDTO;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { property_id, ...rest } = req.body;

      const created = await this.tourPackageService.create({
        ...rest,
        property: { id: property_id } as TourPackage["property"],
      });

      reply.send(created);
    } catch (error: any) {
      this.handleError(reply, error, "Error creating tour package", "30001");
    }
  }

  async findAll(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const tours = await this.tourPackageService.findAll();
      reply.send(tours);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching tour packages", "30002");
    }
  }

  async findById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const tour = await this.tourPackageService.findById(req.params.id);
      if (!tour) {
        return reply
          .code(404)
          .send({ message: "Tour package not found", code: "30003" });
      }
      reply.send(tour);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching tour package", "30003");
    }
  }

  async findByLocationId(
    req: FastifyRequest<{ Querystring: { locationId: number[] } }>,
    reply: FastifyReply
  ) {
    try {
      const tours = await this.tourPackageService.findByLocationId(
        req.query.locationId
      );
      reply.send(tours);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error fetching tour packages by location",
        "30004"
      );
    }
  }

  async findByProperty(
    req: FastifyRequest<{ Params: { propertyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const tours = await this.tourPackageService.findByProperty(
        req.params.propertyId
      );
      reply.send(tours);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching by property", "30004");
    }
  }

  async update(
    req: FastifyRequest<{
      Params: { id: string };
      Body: TourPackageReceiveDTO;
    }>,
    reply: FastifyReply
  ) {
    try {
      const updated = await this.tourPackageService.update(
        req.params.id,
        req.body as Partial<TourPackage>
      );
      reply.send(updated);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating tour package", "30005");
    }
  }

  async deactivate(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.tourPackageService.deactivate(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error deactivating tour package",
        "30006"
      );
    }
  }

  async delete(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.tourPackageService.delete(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deleting tour package", "30007");
    }
  }

  async search(
    req: FastifyRequest<{ Querystring: { term: string } }>,
    reply: FastifyReply
  ) {
    try {
      const results = await this.tourPackageService.search(req.query.term);
      reply.send(results);
    } catch (error: any) {
      this.handleError(reply, error, "Error searching tour packages", "30008");
    }
  }

  private handleError(
    reply: FastifyReply,
    error: any,
    defaultMessage: string,
    code: string
  ) {
    let parsedError = { message: defaultMessage, code };
    try {
      parsedError = JSON.parse(error.message);
    } catch (_) {
      parsedError.message = error.message || defaultMessage;
    }
    reply.code(400).send(parsedError);
  }
}
