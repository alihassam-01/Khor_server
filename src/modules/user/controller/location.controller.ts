import { FastifyRequest, FastifyReply } from "fastify";
import { LocationService } from "../service/location.service";

export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  async createLocation(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const location = await this.locationService.createLocation(req.body);
      reply.code(201).send(location);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getLocationById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const location = await this.locationService.getLocationById(Number(req.params.id));
      if (!location) return reply.code(404).send({ message: "Location not found" });
      reply.send(location);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getLocationBySlug(req: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) {
    try {
      const location = await this.locationService.getLocationBySlug(req.params.slug);
      if (!location) return reply.code(404).send({ message: "Location not found" });
      reply.send(location);
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

  async updateLocation(req: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) {
    try {
      console.log("update location: ", req.body)
      const updated = await this.locationService.updateLocation(Number(req.params.id), req.body);
      if (!updated) return reply.code(404).send({ message: "Location not found" });
      reply.send(updated);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async deleteLocation(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const success = await this.locationService.deleteLocation(Number(req.params.id));
      if (!success) return reply.code(404).send({ message: "Location not found" });
      reply.send({ message: "Location deleted successfully" });
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  // CATEGORY CONTROLLERS

  async createCategory(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
    try {
      const category = await this.locationService.createCategory(req.body);
      reply.code(201).send(category);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getAllCategories(_: FastifyRequest, reply: FastifyReply) {
    try {
      const categories = await this.locationService.getAllCategories();
      reply.send(categories);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getCategoryById(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const category = await this.locationService.getCategoryById(Number(req.params.id));
      if (!category) return reply.code(404).send({ message: "Category not found" });
      reply.send(category);
    }
    catch (error: any) {
      this.handleError(error, reply);
    }
  }
  async getCategoryBySlug(req: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) {
    try {
      const category = await this.locationService.getCategoryBySlug(req.params.slug);
      if (!category) return reply.code(404).send({ message: "Category not found" });
      reply.send(category);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async getCategoryByName(req: FastifyRequest<{ Params: { categoryname: string } }>, reply: FastifyReply) {
    try {
      console.log("getCategoryByName: ", req.params.categoryname, "req.params: ", req.params);
      const category = await this.locationService.getLocationsByCategoryName(req.params.categoryname);
      if (!category) return reply.code(404).send({ message: "Category not found" });
      reply.send(category);
    }catch (error: any) {
      this.handleError(error, reply);
    }
  }
  // async getCategoryTree(_: FastifyRequest, reply: FastifyReply) {
  //   try {
  //     const tree = await this.locationService.getCategoryTree();
  //     reply.send(tree);
  //   } catch (error: any) {
  //     this.handleError(error, reply);
  //   }
  // }

  // async deleteCategory(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  //   try {
  //     const success = await this.locationService.deleteCategory(Number(req.params.id));
  //     if (!success) return reply.code(404).send({ message: "Category not found" });
  //     reply.send({ message: "Category deleted successfully" });
  //   } catch (error: any) {
  //     this.handleError(error, reply);
  //   }
  // }

  // ATTRIBUTE CONTROLLERS

  // async createAttribute(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
  //   try {
  //     const attribute = await this.locationService.createAttribute(req.body);
  //     reply.code(201).send(attribute);
  //   } catch (error: any) {
  //     this.handleError(error, reply);
  //   }
  // }

  // async getAllAttributes(_: FastifyRequest, reply: FastifyReply) {
  //   try {
  //     const attributes = await this.locationService.getAllAttributes();
  //     reply.send(attributes);
  //   } catch (error: any) {
  //     this.handleError(error, reply);
  //   }
  // }

  // async deleteAttribute(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  //   try {
  //     const success = await this.locationService.deleteAttribute(Number(req.params.id));
  //     if (!success) return reply.code(404).send({ message: "Attribute not found" });
  //     reply.send({ message: "Attribute deleted successfully" });
  //   } catch (error: any) {
  //     this.handleError(error, reply);
  //   }
  // }

  // ATTRIBUTE + CATEGORY MAPPING

  async setLocationAttributes(req: FastifyRequest<{ Body: { locationId: number; attributes: Record<string, string> } }>, reply: FastifyReply) {
    try {
      const updated = await this.locationService.setLocationAttributes(req.body.locationId, req.body.attributes);
      reply.send(updated);
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  async setLocationCategories(req: FastifyRequest<{ Body: { locationId: number; categories: number[] } }>, reply: FastifyReply) {
    try {
      await this.locationService.setLocationCategories(req.body.locationId, req.body.categories);
      reply.send({ message: "Categories set successfully" });
    } catch (error: any) {
      this.handleError(error, reply);
    }
  }

  // ERROR HANDLER

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
