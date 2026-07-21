import { FastifyRequest, FastifyReply } from "fastify";
import { SeoService } from "@modules/user/service/seo.service";

export class SeoController {
  private seoService: SeoService;

  constructor(seoService: SeoService) {
    this.seoService = seoService;
  }

  /**
   * Returns a fully-rendered HTML page with proper SEO meta tags.
   * Used by Nginx to serve crawlers a page with correct title/description/OG tags.
   *
   * GET /api/seo/render?path=/destinations/chumik-farol
   */
  async renderForCrawler(
    request: FastifyRequest<{ Querystring: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { path } = request.query;

    if (!path) {
      reply.status(400).send({ error: "Missing 'path' query parameter" });
      return;
    }

    const meta = await this.seoService.getMetaForPath(path);

    if (!meta) {
      // Not a known SEO route — let Nginx fall through to the SPA
      reply.status(404).send({ error: "No SEO data for this path" });
      return;
    }

    const html = this.seoService.renderSeoHtml(meta);
    reply.type("text/html").send(html);
  }

  /**
   * Returns SEO meta as JSON (useful for debugging).
   *
   * GET /api/seo/meta?path=/destinations/chumik-farol
   */
  async getMeta(
    request: FastifyRequest<{ Querystring: { path: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { path } = request.query;

    if (!path) {
      reply.status(400).send({ error: "Missing 'path' query parameter" });
      return;
    }

    const meta = await this.seoService.getMetaForPath(path);

    if (!meta) {
      reply.status(404).send({ error: "No SEO data for this path" });
      return;
    }

    reply.send(meta);
  }
}
