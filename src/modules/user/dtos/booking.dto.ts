export type ICreateBookingDto = {
  customer_id: string;
  booking_type: "hotel" | "car_rental" | "tour";
  property_id?: string;
  room_type_id?: string;
  rooms_count?: number;
  vehicle_id?: string;
  tour_package_id?: string;
  participants_count?: number;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  special_requests?: string;
};

export type IPaymentDetailsDto = {
  payment_method: string;
  card_number?: string;
  card_exp_month?: number;
  card_exp_year?: number;
  card_cvc?: string;
  card_holder_name?: string;
};