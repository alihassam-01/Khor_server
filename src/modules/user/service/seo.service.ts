import { AppDataSource } from "@config/ormconfig";
import { Article } from "@modules/user/entity/article";
import { CONFIG } from "@config/config";

const WEB_DOMAIN = CONFIG.web_domain.url || "https://gokhor.com";

interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogType: string;
  jsonLd: Record<string, unknown> | null;
}

export class SeoService {
  private articleRepository = AppDataSource.getRepository(Article);

  /**
   * Build meta tags for a given frontend path.
   * Returns null if the path doesn't match a known dynamic route.
   */
  async getMetaForPath(path: string): Promise<SeoMeta | null> {
    // Normalize path
    const cleanPath = path.replace(/\/+$/, "") || "/";

    // ─── Destination pages: /destinations/:slug ───────────────────
    const destMatch = cleanPath.match(/^\/destinations\/([a-z0-9-]+)$/i);
    if (destMatch) {
      return this.getDestinationMeta(destMatch[1]);
    }

    // ─── Static pages ─────────────────────────────────────────────
    const staticMeta = this.getStaticPageMeta(cleanPath);
    if (staticMeta) return staticMeta;

    return null;
  }

  private async getDestinationMeta(slug: string): Promise<SeoMeta | null> {
    const article = await this.articleRepository.findOne({
      where: { slug, is_deleted: false },
    });

    if (!article) return null;

    const title = article.seo_title || `${article.title} — Discover ${article.title} in Baltistan`;
    const description =
      article.seo_description ||
      article.excerpt ||
      `Explore ${article.title} in Gilgit-Baltistan. Discover breathtaking landscapes, local culture, travel tips, and the best time to visit.`;
    const image = article.image_urls?.[0] || "";
    const canonical = `${WEB_DOMAIN}/destinations/${slug}`;

    return {
      title: `${title} | Khor`,
      description: description.slice(0, 320),
      canonical,
      ogImage: image,
      ogType: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "TouristDestination",
        name: article.title,
        description: description.slice(0, 320),
        url: canonical,
        image: article.image_urls?.slice(0, 5) || [],
        touristType: "Adventure Travel",
        isAccessibleForFree: true,
        publisher: {
          "@type": "Organization",
          name: "Khor",
          url: WEB_DOMAIN,
          logo: `${WEB_DOMAIN}/favicon.svg`,
        },
      },
    };
  }

  private getStaticPageMeta(path: string): SeoMeta | null {
    const pages: Record<string, { title: string; description: string }> = {
      "/": {
        title: "Khor — Explore Gilgit-Baltistan | Hotels, Destinations & Travel Guide",
        description:
          "Discover Gilgit-Baltistan with Khor. Find breathtaking destinations, book top-rated hotels, authentic restaurants, and plan your Northern Pakistan adventure.",
      },
      "/destinations": {
        title: "All Destinations — Gilgit-Baltistan Travel Guide | Khor",
        description:
          "Browse stunning destinations across Gilgit-Baltistan. From Skardu to Hunza, discover lakes, mountains, deserts, and ancient forts with Khor.",
      },
      "/hotels-restaurants": {
        title: "Hotels & Restaurants in Gilgit-Baltistan | Khor",
        description:
          "Find and book the best hotels and restaurants across Gilgit-Baltistan. Verified listings with real reviews.",
      },
      "/about": {
        title: "About Khor — Travel Redefined | Gilgit-Baltistan",
        description:
          "Learn about Khor's mission to make Gilgit-Baltistan travel accessible, authentic, and unforgettable.",
      },
      "/contact": {
        title: "Contact Us | Khor",
        description:
          "Get in touch with the Khor team. Questions, partnerships, or feedback — we'd love to hear from you.",
      },
      "/partner": {
        title: "Become a Partner | Khor",
        description:
          "List your hotel, restaurant, or travel service on Khor and reach thousands of travelers exploring Gilgit-Baltistan.",
      },
    };

    const page = pages[path];
    if (!page) return null;

    return {
      title: page.title,
      description: page.description,
      canonical: `${WEB_DOMAIN}${path === "/" ? "" : path}`,
      ogImage: `https://pub-e39b558a4bdb4b29b53fe2b33f7dd97a.r2.dev/uploads/Frontend/hero.avif`,
      ogType: "website",
      jsonLd: path === "/" ? {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Khor",
        url: WEB_DOMAIN,
        description: page.description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${WEB_DOMAIN}/destinations?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      } : null,
    };
  }

  /**
   * Renders a full HTML page with proper meta tags for crawlers.
   */
  renderSeoHtml(meta: SeoMeta): string {
    const jsonLdScript = meta.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(meta.title)}</title>
  <meta name="description" content="${this.escapeHtml(meta.description)}">
  <link rel="canonical" href="${meta.canonical}">

  <!-- Open Graph -->
  <meta property="og:title" content="${this.escapeHtml(meta.title)}">
  <meta property="og:description" content="${this.escapeHtml(meta.description)}">
  <meta property="og:url" content="${meta.canonical}">
  <meta property="og:type" content="${meta.ogType}">
  <meta property="og:site_name" content="Khor">
  ${meta.ogImage ? `<meta property="og:image" content="${meta.ogImage}">` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${this.escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${this.escapeHtml(meta.description)}">
  ${meta.ogImage ? `<meta name="twitter:image" content="${meta.ogImage}">` : ""}

  ${jsonLdScript}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
</head>
<body>
  <div id="root">
    <h1>${this.escapeHtml(meta.title)}</h1>
    <p>${this.escapeHtml(meta.description)}</p>
    <a href="${meta.canonical}">View on Khor</a>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
