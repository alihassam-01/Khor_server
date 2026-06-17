import { FastifyInstance } from "fastify";
import { TagController } from "@modules/user/controller";
import { TagService } from "@modules/user/service";
import { authenticate } from "@middlewares/authenticate";
import { authorizeAdmin } from "@middlewares/authorizeAdmin";
import { ICreateTagBody, ITagIdParams, IUpdateTagBody } from "@modules/user/types";

export async function tagRoutes(app: FastifyInstance) {
  const controller = new TagController(new TagService());
  const adminOnly = [authenticate, authorizeAdmin];

  app.post<{ Body: ICreateTagBody }>("/tags", { preHandler: adminOnly }, controller.create.bind(controller));
  app.get("/tags", controller.findAll.bind(controller));
  app.get<{ Params: ITagIdParams }>("/tags/:tagId", controller.findById.bind(controller));
  app.put<{ Params: ITagIdParams; Body: IUpdateTagBody }>("/tags/:tagId", { preHandler: adminOnly }, controller.update.bind(controller));
  app.delete<{ Params: ITagIdParams }>("/tags/:tagId", { preHandler: adminOnly }, controller.delete.bind(controller));
}
