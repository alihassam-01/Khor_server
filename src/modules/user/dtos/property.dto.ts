export interface CreateProperty {
  name: string;
  description: string;
  streetAddress?: string;
  localityId: string;
  landmark?: string;
  plusCode?: string;
  vendorId: string;
  type: string;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}
