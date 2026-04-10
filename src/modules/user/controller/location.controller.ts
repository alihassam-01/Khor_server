import { FastifyRequest, FastifyReply } from "fastify";
import { LocationService } from "@modules/user/service/location.service";
import {
  ICreateLocationDto,
  IUpdateLocationDto,
  ILocationDTO,
  ICreateLocationCategoryDto
} from "@modules/user/dtos";
import {
  ILocationIdParams,
  ILocationSlugParams,
  ILocationTypeParams,
  ICategoryIdParams,
  ICategorySlugParams,
  ICategoryNameParams,
  ISetLocationAttributesBody,
  ISetLocationCategoriesBody,
  ILocationChildrenParams
} from "@modules/user/types";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";

export class LocationController {
  constructor(
    private readonly locationService: LocationService
  ) { }

  async createLocation(
    req: FastifyRequest<{ Body: ICreateLocationDto }>,
    reply: FastifyReply
  ) {
    const location: ILocationDTO = await this.locationService.createLocation(req.body);
    reply.code(201).send(location);
  }

  async getAllCities(_: FastifyRequest, reply: FastifyReply) {
    const cities: ILocationDTO[] = await this.locationService.getAllCities();
    reply.send(cities);
  }

  async getLocationsByType(
    req: FastifyRequest<{ Params: ILocationTypeParams }>,
    reply: FastifyReply
  ) {
    const type = req.params.type;
    const locations: ILocationDTO[] = await this.locationService.getLocationsByType(type);
    reply.send(locations);
  }

  async getLocationById(
    req: FastifyRequest<{ Params: ILocationIdParams }>,
    reply: FastifyReply
  ) {
    const location = await this.locationService.getLocationById(
      Number(req.params.id)
    );
    if (!location)
      throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
    reply.send(location);
  }

  async getLocationBySlug(
    req: FastifyRequest<{ Params: ILocationSlugParams }>,
    reply: FastifyReply
  ) {
    const location = await this.locationService.getLocationBySlug(
      req.params.slug
    );
    if (!location)
      throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
    reply.send(location);
  }

  async getAllLocations(_: FastifyRequest, reply: FastifyReply) {
    const locations: ILocationDTO[] = await this.locationService.getAllLocations();
    reply.send(locations);
  }

  async updateLocation(
    req: FastifyRequest<{ Params: ILocationIdParams; Body: IUpdateLocationDto }>,
    reply: FastifyReply
  ) {
    const updated = await this.locationService.updateLocation(
      Number(req.params.id),
      req.body
    );
    if (!updated)
      throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
    reply.send(updated);
  }

  async deleteLocation(
    req: FastifyRequest<{ Params: ILocationIdParams }>,
    reply: FastifyReply
  ) {
    const success = await this.locationService.deleteLocation(
      Number(req.params.id)
    );
    if (!success)
      throw new AppError("Location not found", 404, ErrorCodes.NOT_FOUND);
    reply.send({ message: "Location deleted successfully" });
  }

  // CATEGORY CONTROLLERS

  async createCategory(
    req: FastifyRequest<{ Body: ICreateLocationCategoryDto }>,
    reply: FastifyReply
  ) {
    const category = await this.locationService.createCategory(req.body);
    reply.code(201).send(category);
  }

  async getAllCategories(_: FastifyRequest, reply: FastifyReply) {
    const categories = await this.locationService.getAllCategories();
    reply.send(categories);
  }

  async getCategoryById(
    req: FastifyRequest<{ Params: ICategoryIdParams }>,
    reply: FastifyReply
  ) {
    const category = await this.locationService.getCategoryById(
      Number(req.params.id)
    );
    if (!category)
      throw new AppError("Category not found", 404, ErrorCodes.NOT_FOUND);
    reply.send(category);
  }

  async getCategoryBySlug(
    req: FastifyRequest<{ Params: ICategorySlugParams }>,
    reply: FastifyReply
  ) {
    const category = await this.locationService.getCategoryBySlug(
      req.params.slug
    );
    if (!category)
      throw new AppError("Category not found", 404, ErrorCodes.NOT_FOUND);
    reply.send(category);
  }

  async getCategoryByName(
    req: FastifyRequest<{ Params: ICategoryNameParams }>,
    reply: FastifyReply
  ) {
    const locations: ILocationDTO[] = await this.locationService.getLocationsByCategoryName(
      req.params.categoryname
    );
    reply.send(locations);
  }

  // ATTRIBUTE + CATEGORY MAPPING

  async setLocationAttributes(
    req: FastifyRequest<{ Body: ISetLocationAttributesBody }>,
    reply: FastifyReply
  ) {
    await this.locationService.setLocationAttributes(
      req.body.locationId,
      req.body.attributes
    );
    reply.send({ message: "Attributes set successfully" });
  }

  async setLocationCategories(
    req: FastifyRequest<{ Body: ISetLocationCategoriesBody }>,
    reply: FastifyReply
  ) {
    await this.locationService.setLocationCategories(
      req.body.locationId,
      req.body.categories
    );
    reply.send({ message: "Categories set successfully" });
  }

  async getLocationChildren(
    req: FastifyRequest<{ Params: ILocationChildrenParams }>,
    reply: FastifyReply
  ) {
    const children: ILocationDTO[] = await this.locationService.getLocationChildren(
      Number(req.params.locationId)
    );
    reply.send(children);
  }
}
