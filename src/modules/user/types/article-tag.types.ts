export interface IArticleTagPair {
    article_id: number;
    tag_id: number;
}

export interface IBulkAssignTagsBody {
    pairs: IArticleTagPair[];
}

export interface IArticleIdTagParams {
    articleId: string;
}

export interface ITagIdTagParams {
    tagId: string;
}
