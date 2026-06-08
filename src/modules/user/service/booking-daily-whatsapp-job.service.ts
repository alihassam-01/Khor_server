import { HotelBookingStatus } from "@common/enums/booking.enums";
import { CONFIG } from "@config/config";
import { AppDataSource } from "@config/ormconfig";
import { HotelBooking } from "@modules/user/entity/booking";
import { NotificationOutboxService } from "./notification-outbox.service";
import { logInfo } from "@lib/logger";

type VendorBookingRow = HotelBooking & {
    listing: HotelBooking["listing"] & {
        vendor?: NonNullable<HotelBooking["listing"]>["vendor"];
    };
};

export class BookingDailyWhatsAppJobService {
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly outboxService = new NotificationOutboxService();

    private getTodayIsoDate(): string {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: CONFIG.notifications.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    private formatDateLabel(date: string): string {
        return new Intl.DateTimeFormat("en-PK", {
            dateStyle: "full",
            timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00.000Z`));
    }

    private getOwnerName(row: VendorBookingRow): string {
        return row.listing.vendor?.profile?.business_name
            || row.listing.vendor?.profile?.username
            || row.listing.vendor?.email
            || "Hotel owner";
    }

    async enqueueTodayOwnerCheckInDigests(): Promise<void> {
        const today = this.getTodayIsoDate();
        const rows = await this.bookingRepo.createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.contact", "listing_contact")
            .leftJoinAndSelect("listing.vendor", "vendor")
            .leftJoinAndSelect("vendor.profile", "vendor_profile")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .where("booking.check_in_date = :today", { today })
            .andWhere("booking.booking_status IN (:...statuses)", {
                statuses: [HotelBookingStatus.PENDING, HotelBookingStatus.CONFIRMED],
            })
            .orderBy("vendor.id", "ASC")
            .addOrderBy("listing.name", "ASC")
            .addOrderBy("booking.created_at", "ASC")
            .getMany() as unknown as VendorBookingRow[];

        const groups = new Map<string, {
            ownerPhone?: string | null;
            ownerName: string;
            items: Array<{
                bookingNumber: string;
                hotelName: string;
                roomName: string;
                guestName: string;
                guestPhone: string;
                guestCount: number;
                roomsCount: number;
            }>;
        }>();

        for (const row of rows) {
            const vendor = row.listing.vendor;
            if (!vendor?.id) continue;
            const group = groups.get(vendor.id) ?? {
                ownerPhone: vendor.profile?.phone_number
                    ?? row.listing.contact?.whatsapp
                    ?? row.listing.contact?.phone,
                ownerName: this.getOwnerName(row),
                items: [],
            };
            group.items.push({
                bookingNumber: row.booking_number,
                hotelName: row.listing.name,
                roomName: row.room_type?.name ?? "Room",
                guestName: row.guest_name,
                guestPhone: row.guest_phone,
                guestCount: row.guest_count,
                roomsCount: row.rooms_count,
            });
            groups.set(vendor.id, group);
        }

        const dateLabel = this.formatDateLabel(today);
        await Promise.all(Array.from(groups.entries()).map(([ownerId, group]) =>
            this.outboxService.enqueueOwnerCheckInDigest({
                manager: AppDataSource.manager,
                ownerId,
                ownerPhone: group.ownerPhone,
                ownerName: group.ownerName,
                localDate: today,
                dateLabel,
                items: group.items,
            }),
        ));

        logInfo("Owner WhatsApp check-in digests enqueued.", {
            date: today,
            ownerCount: groups.size,
        });
    }
}

