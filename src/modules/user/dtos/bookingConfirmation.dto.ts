// Base Types
interface IBaseBooking {
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
  customerInfo: ICustomerInfo;
  propertyLocation: IPropertyLocation;
}

interface ICustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  address: string;
  specialRequests?: string;
  customerId: string;
}

interface IPropertyLocation {
  locality: string | null;
  city: string | null;
  address: IAddress | null;
}

interface IAddress {
  address_id: number;
  street_address: string;
  location: ILocation;
  landmark: string;
  is_primary: boolean;
}

interface ILocation {
  location_id: number;
  name: string;
  plusCode: string;
  location_order: number;
  description: string;
  is_deleted: boolean;
  created_at: string;
  slug: string;
  updated_at: string;
  parent?: ILocationParent;
}

interface ILocationParent {
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
interface ITourBooking extends IBaseBooking {
  booking_type: "tour";
  plan: ITourPlan;
  tour_package_id: string;
  packageName: string;
}

interface ITourPlan {
  planType: "complete-package" | "custom" | string;
  duration: string;
}

interface IHotelBooking extends IBaseBooking {
  booking_type: "hotel";
  room_type_id: string;
  roomName: string;
}

// Union type for all booking types
type IBookingConfirmation = ITourBooking | IHotelBooking;

// Type guard functions
function isTourBooking(booking: IBookingConfirmation): booking is ITourBooking {
  return booking.booking_type === "tour";
}

function isHotelBooking(booking: IBookingConfirmation): booking is IHotelBooking {
  return booking.booking_type === "hotel";
}

function getBookingDescription(booking: IBookingConfirmation): string {
  switch (booking.booking_type) {
    case "tour":
      return `Tour: ${booking.packageName} for ${booking.participants_count} people`;
    case "hotel":
      return `Hotel: ${booking.roomName} for ${booking.participants_count} guest(s)`;
    default:
      return "Unknown booking type";
  }
}

interface IEmailBookingData {
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
  // Additional fields that might be passed
  customerInfo?: {
    fullName: string;
    email: string;
    phone: string;
  };
}

// Export everything if needed
export type {
  IBaseBooking,
  ICustomerInfo,
  IPropertyLocation,
  IAddress,
  ILocation,
  ILocationParent,
  ITourBooking,
  ITourPlan,
  IHotelBooking,
  IBookingConfirmation,
  IEmailBookingData,
};

export { isTourBooking, isHotelBooking, getBookingDescription };
