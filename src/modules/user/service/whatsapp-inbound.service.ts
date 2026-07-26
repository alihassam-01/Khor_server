import { AppDataSource } from "@config/ormconfig";
import { BusinessProfile } from "../entity/user/business-profile.entity";
import { Listing } from "../entity/listing/listing.entity";
import { HotelRoomType } from "@modules/user/entity/listing";
import { HotelBooking } from "@modules/user/entity/booking";
import { BookingService } from "./booking.service";
import { ICreateHotelBookingDTO } from "../dtos";
import { ILike } from "typeorm";
import { UserRole } from "@common/enums/user.enums";
import { ListingType } from "@common/enums/listing.enums";

export class WhatsappInboundService {
    private bookingService = new BookingService();

    async handleInboundMessage(senderPhone: string, messageBody: string): Promise<string | null> {
        const text = messageBody.trim();
        const firstWord = text.split(/[\s\n]+/)[0].toUpperCase();
        
        if (!["BOOK", "BOOKINGS", "AVAILABILITY", "HELP"].includes(firstWord)) {
            return null; // Ignore non-booking commands silently
        }

        let normalizedPhone = senderPhone.replace(/[\s\-]/g, "");
        if (normalizedPhone.startsWith("03")) {
            normalizedPhone = "+92" + normalizedPhone.substring(1);
        } else if (!normalizedPhone.startsWith("+")) {
            normalizedPhone = "+" + normalizedPhone;
        }
        // For DB lookup, strip all non-digits to be safe against formatting
        const dbSearchPhone = normalizedPhone.replace(/\D/g, "");

        // 1. Authenticate vendor
        const profileRepo = AppDataSource.getRepository(BusinessProfile);
        
        // Try matching with or without '+' 
        const profile = await profileRepo.createQueryBuilder("profile")
            .where("REPLACE(profile.whatsapp_number, '+', '') = :phone", { phone: dbSearchPhone })
            .andWhere("profile.whatsapp_booking_enabled = :enabled", { enabled: true })
            .getOne();

        if (!profile || !profile.user_id) {
            return "❌ Access Denied\n\nYour WhatsApp number is not registered as a vendor, or WhatsApp booking is not enabled for your account.";
        }

        const vendorId = profile.user_id;

        try {
            if (firstWord === "HELP") {
                return this.handleHelpCommand();
            } else if (firstWord === "AVAILABILITY") {
                return await this.handleAvailabilityCommand(vendorId, text);
            } else if (firstWord === "BOOKINGS") {
                return await this.handleBookingsCommand(vendorId, text);
            } else if (firstWord === "BOOK") {
                return await this.handleBookCommand(vendorId, messageBody);
            }
        } catch (error: any) {
            return `❌ Request Failed\n\nError: ${error.message}`;
        }
        return null;
    }

    private handleHelpCommand(): string {
        return `🤖 *Khor Vendor Bot Help*

Here are the commands you can use:

1️⃣ *Check Availability*
Type \`AVAILABILITY\` or \`AVAILABILITY YYYY-MM-DD\`
Shows all rooms, available quantity, and price.

2️⃣ *Check Bookings*
Type \`BOOKINGS\` or \`BOOKINGS YYYY-MM-DD\`
Shows all active bookings for a specific date.

3️⃣ *Create Booking*
Use the template below to create a booking:

BOOK
Hotel: My Hotel Name
Rooms List: Single: 1, Double: 1
Guest: Muhammad Ali
Guest Email: ali@example.com
Guest Whatsapp: +923001234567
CheckIn: 2026-08-01
CheckOut: 2026-08-03
Guests: 2
Payment: 0`;
    }

    private async handleAvailabilityCommand(vendorId: string, text: string): Promise<string> {
        const parts = text.split(/[\s\n]+/);
        let dateStr = parts[1];
        if (!dateStr) {
            // Default to today
            dateStr = new Date().toISOString().split('T')[0];
        }

        const listingRepo = AppDataSource.getRepository(Listing);
        const hotel = await listingRepo.findOne({
            where: { vendor_id: vendorId, type: ListingType.HOTEL }
        });

        if (!hotel) return "❌ No hotel found for your account.";

        const roomRepo = AppDataSource.getRepository(HotelRoomType);
        const rooms = await roomRepo.find({ where: { listing_id: hotel.id, is_active: true } });

        if (rooms.length === 0) return `No active rooms found in ${hotel.name}.`;

        const checkIn = dateStr;
        const checkOutDate = new Date(new Date(dateStr).getTime() + 86400000);
        const checkOut = checkOutDate.toISOString().split('T')[0];

        let msg = `🏨 *Availability for ${hotel.name}*\n📅 Date: ${dateStr}\n\n`;
        
        for (const room of rooms) {
            const avail = await this.bookingService.getAvailability(hotel.id, room.id, checkIn, checkOut);
            msg += `• *${room.name}*\n  Available: ${avail.available_rooms} / ${room.total_rooms}\n  Rate: ${room.price}\n\n`;
        }

        return msg.trim();
    }

    private async handleBookingsCommand(vendorId: string, text: string): Promise<string> {
        const parts = text.split(/[\s\n]+/);
        let dateStr = parts[1];
        if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
        }

        const listingRepo = AppDataSource.getRepository(Listing);
        const hotel = await listingRepo.findOne({
            where: { vendor_id: vendorId, type: ListingType.HOTEL }
        });

        if (!hotel) return "❌ No hotel found for your account.";

        const bookingRepo = AppDataSource.getRepository(HotelBooking);
        const bookings = await bookingRepo.createQueryBuilder("b")
            .innerJoinAndSelect("b.room_type", "rt")
            .where("b.listing_id = :listingId", { listingId: hotel.id })
            .andWhere("b.check_in_date <= :date", { date: dateStr })
            .andWhere("b.check_out_date > :date", { date: dateStr })
            .orderBy("b.check_in_date", "ASC")
            .getMany();

        if (bookings.length === 0) {
            return `🏨 *Bookings for ${hotel.name}*\n📅 Date: ${dateStr}\n\nNo active bookings for this date.`;
        }

        let msg = `🏨 *Bookings for ${hotel.name}*\n📅 Date: ${dateStr}\nTotal: ${bookings.length} bookings\n\n`;
        for (const b of bookings) {
            msg += `👤 *${b.guest_name}* (${b.guest_phone})\n`;
            msg += `  Booking #: ${b.booking_number}\n`;
            msg += `  Room: ${b.room_type.name} (x${b.rooms_count})\n`;
            msg += `  Status: ${b.booking_status}\n\n`;
        }

        return msg.trim();
    }

    private async handleBookCommand(vendorId: string, messageBody: string): Promise<string> {
        // 2. Parse message
        const parsed = this.parseBookingMessage(messageBody);
        if (!parsed) {
            return "❌ Booking Failed\n\nInvalid message format. Please type HELP to see the correct format.";
        }

        const listingRepo = AppDataSource.getRepository(Listing);
        const hotel = await listingRepo.findOne({
            where: {
                vendor_id: vendorId,
                type: ListingType.HOTEL,
                name: ILike(`%${parsed.hotelName}%`)
            }
        });

        if (!hotel) {
            return `❌ Booking Failed\n\nCould not find a hotel named "${parsed.hotelName}" in your account.`;
        }

        // 4. Find Rooms
        const roomRepo = AppDataSource.getRepository(HotelRoomType);
        const resolvedAllocations: { room_type_id: string, rooms_count: number }[] = [];
        const roomNames: string[] = [];

        for (const alloc of parsed.roomAllocations) {
            const room = await roomRepo.findOne({
                where: {
                    listing_id: hotel.id,
                    name: ILike(`%${alloc.name}%`)
                }
            });

            if (!room) {
                return `❌ Booking Failed\n\nCould not find a room named "${alloc.name}" in ${hotel.name}.`;
            }

            resolvedAllocations.push({ room_type_id: room.id, rooms_count: alloc.count });
            roomNames.push(`${room.name} (x${alloc.count})`);
        }

        // 5. Create Booking
        const dto: ICreateHotelBookingDTO = {
            listing_id: hotel.id,
            room_type_id: resolvedAllocations[0].room_type_id, // Required fallback
            rooms_count: resolvedAllocations[0].rooms_count, // Required fallback
            room_allocations: resolvedAllocations,
            guest_count: parsed.guestsCount,
            check_in_date: parsed.checkInDate,
            check_out_date: parsed.checkOutDate,
            guest_name: parsed.guestName,
            guest_phone: parsed.guestWhatsapp,
            guest_email: parsed.guestEmail,
            payment_amount: parsed.paymentAmount
        };

        const actor = { userId: vendorId, userType: UserRole.VENDOR };
        const booking = await this.bookingService.createVendorBooking(actor, dto);

        // 6. Return Success Message
        return `✅ Booking Created!

Booking #: ${booking.booking_number}
Hotel: ${hotel.name}
Rooms: ${roomNames.join(", ")}
Guest: ${parsed.guestName}
Check-in: ${parsed.checkInDate}
Check-out: ${parsed.checkOutDate}
Guests: ${parsed.guestsCount}

Status: Confirmed`;
    }

    private parseBookingMessage(message: string) {
        const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        try {
            const extract = (key: string, optional: boolean = false) => {
                const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase()));
                if (!line) {
                    if (optional) return "";
                    throw new Error(`Missing field: ${key}`);
                }
                return line.substring(line.indexOf(':') + 1).trim();
            };

            const roomAllocations: { name: string, count: number }[] = [];
            
            // Try parsing "Rooms List: Single: 1, Double: 1"
            const roomsList = extract("Rooms List", true);
            if (roomsList) {
                const parts = roomsList.split(',');
                for (const p of parts) {
                    const [name, count] = p.split(':').map(s => s.trim());
                    if (name && count) {
                        roomAllocations.push({ name, count: parseInt(count, 10) || 1 });
                    }
                }
            } else {
                // Fallback to legacy single room format
                roomAllocations.push({
                    name: extract("Room"),
                    count: parseInt(extract("Rooms"), 10) || 1
                });
            }

            if (roomAllocations.length === 0) {
                throw new Error("No rooms specified");
            }

            let guestWhatsapp = extract("Guest Whatsapp");
            // Sanitize and normalize the phone number
            if (guestWhatsapp) {
                guestWhatsapp = guestWhatsapp.replace(/[\s\-]/g, "");
                if (guestWhatsapp.startsWith("03")) {
                    guestWhatsapp = "+92" + guestWhatsapp.substring(1);
                } else if (!guestWhatsapp.startsWith("+")) {
                    guestWhatsapp = "+" + guestWhatsapp;
                }
            }

            return {
                hotelName: extract("Hotel"),
                roomAllocations,
                guestName: extract("Guest"),
                guestEmail: extract("Guest Email", true) || "whatsapp-guest@example.com",
                guestWhatsapp,
                checkInDate: extract("CheckIn"),
                checkOutDate: extract("CheckOut"),
                guestsCount: parseInt(extract("Guests"), 10) || 1,
                paymentAmount: parseFloat(extract("Payment", true)) || 0
            };
        } catch (e) {
            return null;
        }
    }
}
