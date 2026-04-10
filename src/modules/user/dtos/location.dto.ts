import { LocationType } from "@common/enums/location.enums";

export interface ILocationAttributeDTO {
    attributeKey: string;
    attributeValue: string;
}

export interface ILocationCategoryDTO {
    categoryId: number;
    name: string;
    slug: string;
    location_id?: number;
}

export interface ILocationDTO {
    location_id: number;
    name: string;
    slug: string;
    description: string;
    plusCode: string;
    location_order: number;
    location_type: LocationType;
    parent_id?: number | null;
    attributes?: ILocationAttributeDTO[];
    categories?: ILocationCategoryDTO[];
}

export interface ICreateLocationDto {
  name: string;
  description?: string;
  plusCode?: string;
  location_order?: number;
  parent_location_id?: number | null;
  slug?: string;
  attributes?: Record<string, string> | { attributeKey: string, attributeValue: string }[];
  categories?: number[];
  location_type?: LocationType;
}

export interface IUpdateLocationDto {
    name?: string;
    description?: string;
    plusCode?: string;
    location_order?: number;
    parent_location_id?: number | null;
    location_type?: LocationType;
    attributes?: Record<string, string>;
    categories?: number[];
}

export interface ICreateLocationCategoryDto {
    name: string;
    parentCategoryId?: number;
}