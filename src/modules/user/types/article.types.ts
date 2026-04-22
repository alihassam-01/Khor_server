export interface IArticleIdParams {
    id: string;
}

export interface IArticleSlugParams {
    slug: string;
}

export interface IGetArticleQuery {
    all?: string;
    categoryId?: string;
}

export interface IListArticlesQuery {
    page?: string;
    limit?: string;
    status?: string;
    placeId?: string;
    categoryId?: string;
    tag?: string;
}

export interface ISearchArticlesQuery {
    term: string;
    all?: string;
}
