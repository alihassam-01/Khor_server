import { LocationAttributes } from "../entity/location";

export interface ICreateLocationDto {
  name: string;
  description?: string | ""; // Optional
  plusCode?: string;
  location_order?: number; // Optional (defaults to 0)
  parent_location_id?: number | null; // Optional (for hierarchical locations)
  slug?: string; // Optional (if not auto-generated)
  attributes?: Partial<LocationAttributes>[]; // Optional (custom attributes)
  categories?: number[]; // Optional (IDs of categories to associate)
}
export interface ICreateCityDto {
  name: string;
  description?: string | ""; // Optional
  plusCode?: string;
  location_order?: number; // Optional (defaults to 0)
  parent_location_id?: number | null; // Optional (for hierarchical locations)
  slug?: string; // Optional (if not auto-generated)
  attributes?: Partial<LocationAttributes>[]; // Optional (custom attributes)
  categories?: number[]; // Optional (IDs of categories to associate)
  country?: string; // Optional (default is "Pakistan")
}