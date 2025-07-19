import { FastifyReply, FastifyRequest } from "fastify";
import { VehicleService } from "../service/vehicle.service";
import { CreateVehicleDto, UpdateVehicleDto } from "../dtos/vehicle.dto";
import { Vehicle } from "../entity/property";

export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  async create(
    req: FastifyRequest<{ Body: CreateVehicleDto }>,
    reply: FastifyReply
  ) {
    try {
      const { property_id, ...rest } = req.body;

      const vehicle = await this.vehicleService.create({
        ...rest,
        property: { id: property_id } as Vehicle['property'], 
      });

      reply.send(vehicle);
    } catch (error: any) {
      this.handleError(reply, error, "Error creating vehicle", "40001");
    }
  }

  async findAll(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const vehicles = await this.vehicleService.findAll();
      reply.send(vehicles);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching vehicles", "40002");
    }
  }

  async findById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const vehicle = await this.vehicleService.findById(req.params.id);
      if (!vehicle) return reply.code(404).send({ message: "Vehicle not found", code: "40403" });
      reply.send(vehicle);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching vehicle", "40003");
    }
  }

  async findByProperty(
    req: FastifyRequest<{ Params: { propertyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const vehicles = await this.vehicleService.findByProperty(req.params.propertyId);
      reply.send(vehicles);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching vehicles by property", "40004");
    }
  }

  async update(
    req: FastifyRequest<{ Params: { id: string }; Body: UpdateVehicleDto }>,
    reply: FastifyReply
  ) {
    try {
      const updated = await this.vehicleService.update(req.params.id, req.body as UpdateVehicleDto);
      reply.send(updated);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating vehicle", "40005");
    }
  }

  async deactivate(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.vehicleService.deactivate(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deactivating vehicle", "40006");
    }
  }

  async delete(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.vehicleService.delete(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deleting vehicle", "40007");
    }
  }

  async search(
    req: FastifyRequest<{ Querystring: { term: string } }>,
    reply: FastifyReply
  ) {
    try {
      const results = await this.vehicleService.search(req.query.term);
      reply.send(results);
    } catch (error: any) {
      this.handleError(reply, error, "Error searching vehicles", "40008");
    }
  }

  private handleError(reply: FastifyReply, error: any, defaultMessage: string, code: string) {
    let parsedError = { message: defaultMessage, code };
    try {
      parsedError = JSON.parse(error.message);
    } catch (_) {
      parsedError.message = error.message || defaultMessage;
    }
    reply.code(400).send(parsedError);
  }
}
