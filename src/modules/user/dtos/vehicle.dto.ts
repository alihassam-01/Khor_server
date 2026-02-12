export interface ICreateVehicleDto {
  make: string;
  model: string;
  year: number;
  type: string;
  transmission: "manual" | "automatic";
  fuel_type: "petrol" | "diesel" | "electric" | "hybrid";
  seats: number;
  daily_rate: number;
  features?: string[];
  images?: string[];
  license_plate?: string;
  property_id: string;
}

export interface IUpdateVehicleDto extends Partial<ICreateVehicleDto> { }
