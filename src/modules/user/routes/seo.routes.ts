import { FastifyInstance } from "fastify";
import { SeoService } from "@modules/user/service/seo.service";
import { SeoController } from "@modules/user/controller/seo.controller";

export async function seoRoutes(fastify: FastifyInstance) {
  const seoService = new SeoService();
  const seoController = new SeoController(seoService);

  // Public SEO endpoints — no authentication required
  fastify.get<{ Querystring: { path: string } }>(
    "/seo/render",
    seoController.renderForCrawler.bind(seoController)
  );

  fastify.get<{ Querystring: { path: string } }>(
    "/seo/meta",
    seoController.getMeta.bind(seoController)
  );
}
