export interface TourPackageReceiveDTO {
  name: string;
  description?: string;
  duration_days: number;
  max_participants: number;
  price_per_person: number;
  includes?: string[];
  itinerary?: any;
  images?: string[];
  category: "standard" | "premium" | "luxury";
  type: "hotel-only" | "car-rental" | "complete-package";
  property_id: string;
  destination_id?: number[];
}
