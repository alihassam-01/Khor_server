import { FastifyInstance } from "fastify";
import { TagController } from "@modules/user/controller";
import { TagService } from "@modules/user/service";

export async function tagRoutes(app: FastifyInstance) {
  const controller = new TagController(new TagService());

  app.post("/tags", controller.create.bind(controller));
  app.get("/tags", controller.findAll.bind(controller));
  app.get("/tags/:tagId", controller.findById.bind(controller));
  app.put("/tags/:tagId", controller.update.bind(controller));
  app.delete("/tags/:tagId", controller.delete.bind(controller));
}
