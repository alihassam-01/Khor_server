export interface ICreateRoomTypeDto {
  name: string;
  base_price: number;
  max_occupancy: number;
  total_rooms: number;
  description: string;
  propertyId: string;
  images?: string[];
  amenities?: string[];
  active?: boolean;
  size_sqm?: number;
}