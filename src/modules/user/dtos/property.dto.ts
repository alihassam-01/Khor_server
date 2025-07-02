export interface CreateProperty {
  name: string;
  description: string;
  streetAddress?: string;
  localityId: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  vendorId: string;
  type: string;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}
