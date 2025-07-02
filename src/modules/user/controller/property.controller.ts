import { FastifyRequest, FastifyReply } from "fastify";
import { PropertyService } from "../service/property.service";
import { Property } from "../entity/property";
import { Vendor } from "../entity/business";
import { CreateProperty } from "../dtos/property.dto";

export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  async createProperty(
    req: FastifyRequest<{
      Body: CreateProperty;
    }>,
    reply: FastifyReply
  ) {
    try {
      const allowedTypes = ["hotel", "car_rental", "tour"] as const;
      const type = allowedTypes.includes(req.body.type as any) ? req.body.type as "hotel" | "car_rental" | "tour" : "";
      const propertyData = {
        ...req.body,
        type,
        vendor: { id: req.body.vendorId } as Vendor, 
      };
      const property = await this.propertyService.create(propertyData);
      reply.send(property);
    } catch (error: any) {
      this.handleError(reply, error, "Error creating property", "10001");
    }
  }

  async getAllProperties(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const properties = await this.propertyService.findAll();
      reply.send(properties);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching properties", "10002");
    }
  }

  async getPropertyById(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const property = await this.propertyService.findById(req.params.id);
      if (!property) {
        return reply
          .code(404)
          .send({ message: "Property not found", code: "10003" });
      }
      reply.send(property);
    } catch (error: any) {
      this.handleError(reply, error, "Error fetching property", "10003");
    }
  }

  async getPropertiesByVendor(
    req: FastifyRequest<{ Params: { vendorId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const properties = await this.propertyService.findByVendor(
        req.params.vendorId
      );
      reply.send(properties);
    } catch (error: any) {
      this.handleError(
        reply,
        error,
        "Error fetching properties by vendor",
        "10004"
      );
    }
  }

  async updateProperty(
    req: FastifyRequest<{ Params: { id: string }; Body: any }>,
    reply: FastifyReply
  ) {
    try {
      const updates = req.body as Partial<Property>;
      const updated = await this.propertyService.update(req.params.id, updates);
      reply.send(updated);
    } catch (error: any) {
      this.handleError(reply, error, "Error updating property", "10005");
    }
  }

  async deactivateProperty(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.propertyService.deactivate(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deactivating property", "10006");
    }
  }

  async deleteProperty(
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.propertyService.delete(req.params.id);
      reply.send(result);
    } catch (error: any) {
      this.handleError(reply, error, "Error deleting property", "10007");
    }
  }

  async searchProperties(
    req: FastifyRequest<{ Querystring: { term: string } }>,
    reply: FastifyReply
  ) {
    try {
      const results = await this.propertyService.search(req.query.term);
      reply.send(results);
    } catch (error: any) {
      this.handleError(reply, error, "Error searching properties", "10008");
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
