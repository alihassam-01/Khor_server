export interface ICreateProperty {
  name: string;
  description: string;
  streetAddress?: string;
  localityId: string;
  location_id?: number;
  location_name?: string;
  price?: number;
  landmark?: string;
  plusCode?: string;
  vendorId: string;
  type: string;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}
