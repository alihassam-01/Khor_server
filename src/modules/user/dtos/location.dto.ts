import { LocationAttributes } from "../entity/location";
import { LocationType } from "../entity/ENUM/enum";

export interface ICreateLocationDto {
  name: string;
  description?: string | "";
  plusCode?: string;
  location_order?: number;
  parent_location_id?: number | null;
  slug?: string;
  attributes?: Partial<LocationAttributes>[];
  categories?: number[];
  location_type?: LocationType;
}

export interface ICreateCityDto {
  name: string;
  description?: string | "";
  plusCode?: string;
  location_order?: number;
  parent_location_id?: number | null;
  slug?: string;
  attributes?: Partial<LocationAttributes>[];
  categories?: number[];
  country?: string;
}