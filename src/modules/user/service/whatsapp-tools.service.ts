import { HotelService } from "./hotel.service";
import { BookingService } from "./booking.service";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { UserRole } from "@common/enums/user.enums";

// Simple in-memory map to store OTPs for admin manual bookings
const otpStore = new Map<string, { otp: string; bookingData: any; expiresAt: number }>();

export class WhatsappToolsService {
    private hotelService = new HotelService();
    private bookingService = new BookingService();

    /**
     * Search for rooms based on user query.
     */
    async searchRooms(query: { location_id?: number; searchQuery?: string; guests?: number; limit?: number }) {
        const result = await this.hotelService.getAllHotels({
            page: 1,
            limit: query.limit || 5,
            searchQuery: query.searchQuery,
            location_id: query.location_id
        });
        
        return result.items.map(hotel => ({
            id: hotel.id,
            name: hotel.name,
            location: hotel.location,
            price: hotel.price,
            rating: hotel.rating,
            rooms: hotel.roomTypes?.map((r: any) => ({
                id: r.id,
                name: r.name,
                price: r.price_per_night,
                capacity: r.max_guests
            })) || []
        }));
    }

    /**
     * Validate if the phone number belongs to an Admin or Vendor.
     */
    async validateAdminPhone(phone: string) {
        // Mock validation for MVP
        console.log(`Validating admin phone: ${phone}`);
        return true; 
    }

    /**
     * Start the manual booking flow for admins.
     */
    async startAdminBooking(phone: string, bookingData: any) {
        const isAdmin = await this.validateAdminPhone(phone);
        if (!isAdmin) {
            throw new AppError("Unauthorized phone number", 403, ErrorCodes.FORBIDDEN);
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        otpStore.set(phone, {
            otp,
            bookingData,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        return { 
            message: "OTP generated. Ask the admin to provide the OTP to confirm.",
            otp
        };
    }

    /**
     * Confirm the manual admin booking using the OTP.
     */
    async confirmAdminBooking(phone: string, otp: string, adminUserId: string) {
        const session = otpStore.get(phone);
        if (!session || session.expiresAt < Date.now()) {
            throw new AppError("OTP expired or not found", 400, ErrorCodes.VALIDATION_ERROR);
        }

        if (session.otp !== otp) {
            throw new AppError("Invalid OTP", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const bookingData = session.bookingData;
        const actor = { userId: adminUserId, userType: UserRole.ADMIN };

        const booking = await this.bookingService.createVendorBooking(actor as any, bookingData);
        
        otpStore.delete(phone);
        
        return {
            success: true,
            booking_number: booking.booking_number,
            status: booking.booking_status
        };
    }

    /**
     * Create a customer booking and return the web checkout URL.
     */
    async createCustomerBooking(bookingData: any, customerUserId?: string) {
        // Fallback user ID for guest bookings
        const guestUserId = "00000000-0000-0000-0000-000000000000";
        const actor = customerUserId 
            ? { userId: customerUserId, userType: UserRole.CUSTOMER }
            : { userId: guestUserId, userType: UserRole.CUSTOMER };

        const booking = await this.bookingService.createAdminBooking(actor as any, bookingData);
        
        const checkoutUrl = `https://travelbaltistan.com/checkout/${booking.id}`;
        
        return {
            success: true,
            booking_number: booking.booking_number,
            checkout_url: checkoutUrl,
            message: "Booking reserved. Please complete payment using the checkout link."
        };
    }
}
