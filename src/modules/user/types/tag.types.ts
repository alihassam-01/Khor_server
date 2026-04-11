export interface ITagIdParams {
    tagId: string;
}

export interface IUpdateTagBody {
    name?: string;
    slug?: string;
}

export interface ICreateTagBody {
    name: string;
    slug: string;
}
