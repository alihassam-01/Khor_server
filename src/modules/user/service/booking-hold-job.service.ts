import { logInfo } from "@lib/logger";
import { BookingService } from "./booking.service";

export class BookingHoldJobService {
    private readonly bookingService = new BookingService();

    async releaseExpiredHolds(): Promise<number> {
        const released = await this.bookingService.releaseExpiredHolds();
        if (released > 0) {
            logInfo(`Released ${released} expired booking hold(s).`);
        }
        return released;
    }

    async expireExpiredPayments(): Promise<number> {
        const expired = await this.bookingService.expireExpiredPayments();
        if (expired > 0) {
            logInfo(`Expired ${expired} stale booking payment(s).`);
        }
        return expired;
    }
}
