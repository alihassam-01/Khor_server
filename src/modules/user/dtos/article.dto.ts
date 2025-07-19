export interface ArticleDTO {
    article_id: number;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    published_at: Date | null;
    seo_title?: string;
    seo_keywords?: string;
    seo_description?: string;
    image_url?: string;
    location: {
        location_id: number;
        name: string;
    };
    tags: string[];
}
