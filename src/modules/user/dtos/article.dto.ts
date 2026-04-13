export interface IArticleDTO {
    article_id: number;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    published_at: Date | null;
    seo_title?: string;
    seo_keywords?: string;
    seo_description?: string;
    image_urls?: string[];
    locations: {
        location_id: number;
        name: string;
        categories?: {
            categoryId: number;
            name: string;
            slug: string;
        }[];
    }[];
    city?: {
        location_id: number;
        name: string;
        slug: string;
        type?: string;
    } | null;
    locality?: {
        location_id: number;
        name: string;
        slug: string;
        type?: string;
    } | null;
    tags: string[];
    categories: {
        categoryId: number;
        name: string;
        slug: string;
    }[];
}

export interface ICreateArticleDTO {
    title: string;
    slug?: string;
    excerpt?: string;
    content: string;
    published_at?: string | Date | null;
    seo_title?: string;
    seo_keywords?: string;
    seo_description?: string;
    location_ids: number[];
    tags?: string[];
    image_url?: string;
    image_urls?: string[];
    categories?: number[];
}

export interface IUpdateArticleDTO {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    published_at?: string | Date | null;
    seo_title?: string;
    seo_keywords?: string;
    seo_description?: string;
    location_ids?: number[];
    tags?: string[];
    image_url?: string;
    image_urls?: string[];
    categories?: number[];
}

export interface IPaginatedArticlesResponse {
    articles: IArticleDTO[];
    count: number;
}
