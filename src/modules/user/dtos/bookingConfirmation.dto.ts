// Base Types
interface BaseBooking {
  customer_id: string;
  total_amount: number;
  booking_type: "tour" | "hotel";
  booking_status: "pending" | "confirmed" | "cancelled" | "completed";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  participants_count: number;
  special_requests?: string;
  customerInfo: CustomerInfo;
  propertyLocation: PropertyLocation;
}

interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  address: string;
  specialRequests?: string;
  customerId: string;
}

interface PropertyLocation {
  locality: string | null;
  city: string | null;
  address: Address | null;
}

interface Address {
  address_id: number;
  street_address: string;
  location: Location;
  landmark: string;
  is_primary: boolean;
}

interface Location {
  location_id: number;
  name: string;
  plusCode: string;
  location_order: number;
  description: string;
  is_deleted: boolean;
  created_at: string;
  slug: string;
  updated_at: string;
  parent?: LocationParent;
}

interface LocationParent {
  location_id: number;
  name: string;
  plusCode: string;
  location_order: number;
  description: string;
  is_deleted: boolean;
  created_at: string;
  slug: string;
  updated_at: string;
}

// Extended Types
interface TourBooking extends BaseBooking {
  booking_type: "tour";
  plan: TourPlan;
  tour_package_id: string;
  packageName: string;
}

interface TourPlan {
  planType: "complete-package" | "custom" | string;
  duration: string;
}

interface HotelBooking extends BaseBooking {
  booking_type: "hotel";
  room_type_id: string;
  roomName: string;
}

// Union type for all booking types
type BookingConfirmation = TourBooking | HotelBooking;

// Type guard functions
function isTourBooking(booking: BookingConfirmation): booking is TourBooking {
  return booking.booking_type === "tour";
}

function isHotelBooking(booking: BookingConfirmation): booking is HotelBooking {
  return booking.booking_type === "hotel";
}

function getBookingDescription(booking: BookingConfirmation): string {
  switch (booking.booking_type) {
    case "tour":
      return `Tour: ${booking.packageName} for ${booking.participants_count} people`;
    case "hotel":
      return `Hotel: ${booking.roomName} for ${booking.participants_count} guest(s)`;
    default:
      return "Unknown booking type";
  }
}

interface EmailBookingData {
  bookingType: "tour" | "hotel";
  customerEmail: string;
  customerName: string;
  propertyName: string | null | undefined;
  roomName?: string; // Only for hotel bookings
  packageName?: string; // Only for tour bookings
  locality: string | null;
  city: string | null;
  startDate: string;
  endDate: string;
  totalPrice: number;
  guests: number;
  paymentStatus: string;
  bookingStatus: string;
  vendorEmail?: string;
  vendorPhone?: string;
  plan?: {
    planType: string;
    duration: string;
  };
}

// Export everything if needed
export type {
  BaseBooking,
  CustomerInfo,
  PropertyLocation,
  Address,
  Location,
  LocationParent,
  TourBooking,
  TourPlan,
  HotelBooking,
  BookingConfirmation,
  EmailBookingData,
};

export { isTourBooking, isHotelBooking, getBookingDescription };
