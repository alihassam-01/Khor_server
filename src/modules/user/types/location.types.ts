import { LocationType } from "@common/enums/location.enums";

export interface ILocationIdParams {
    id: string;
}

export interface ILocationSlugParams {
    slug: string;
}

export interface ILocationTypeParams {
    type: LocationType;
}

export interface ICategoryIdParams {
    id: string;
}

export interface ICategorySlugParams {
    slug: string;
}

export interface ICategoryNameParams {
    categoryname: string;
}

export interface ISetLocationAttributesBody {
    locationId: number;
    attributes: Record<string, string>;
}

export interface ISetLocationCategoriesBody {
    locationId: number;
    categories: number[];
}

export interface ILocationChildrenParams {
    locationId: string;
}
