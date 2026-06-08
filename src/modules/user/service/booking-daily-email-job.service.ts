import { HotelBookingStatus } from "@common/enums/booking.enums";
import { AppDataSource } from "@config/ormconfig";
import { HotelBooking } from "@modules/user/entity/booking";
import { SendEmail } from "./email/sendEmail";
import { logError, logInfo } from "@lib/logger";

type VendorBookingRow = HotelBooking & {
    listing: HotelBooking["listing"] & {
        vendor?: NonNullable<HotelBooking["listing"]>["vendor"];
    };
};

export class BookingDailyEmailJobService {
    private readonly bookingRepo = AppDataSource.getRepository(HotelBooking);
    private readonly emailService = new SendEmail();
    private getTodayIsoDate(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
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

    async sendTodayOwnerCheckInDigests(): Promise<void> {
        const today = this.getTodayIsoDate();
        const statuses = [HotelBookingStatus.PENDING, HotelBookingStatus.CONFIRMED];
        const rows = await this.bookingRepo.createQueryBuilder("booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.vendor", "vendor")
            .leftJoinAndSelect("vendor.profile", "vendor_profile")
            .leftJoinAndSelect("booking.room_type", "room_type")
            .where("booking.check_in_date = :today", { today })
            .andWhere("booking.booking_status IN (:...statuses)", { statuses })
            .orderBy("vendor.id", "ASC")
            .addOrderBy("listing.name", "ASC")
            .addOrderBy("room_type.name", "ASC")
            .addOrderBy("booking.created_at", "ASC")
            .getMany() as unknown as VendorBookingRow[];

        if (rows.length === 0) {
            logInfo("No owner check-in digest emails to send today.", { date: today });
            return;
        }

        const grouped = new Map<string, {
            email: string;
            ownerName: string;
            items: {
                bookingNumber: string;
                hotelName: string;
                roomName: string;
                guestName: string;
                guestEmail: string;
                guestPhone: string;
                guestCount: number;
                roomsCount: number;
                totalAmount: number;
                status: string;
            }[];
        }>();

        for (const row of rows) {
            const vendor = row.listing.vendor;
            if (!vendor?.id || !vendor.email) {
                continue;
            }

            const group = grouped.get(vendor.id) ?? {
                email: vendor.email,
                ownerName: this.getOwnerName(row),
                items: [] as {
                    bookingNumber: string;
                    hotelName: string;
                    roomName: string;
                    guestName: string;
                    guestEmail: string;
                    guestPhone: string;
                    guestCount: number;
                    roomsCount: number;
                    totalAmount: number;
                    status: string;
                }[],
            };

            group.items.push({
                bookingNumber: row.booking_number,
                hotelName: row.listing.name,
                roomName: row.room_type?.name ?? "Room",
                guestName: row.guest_name,
                guestEmail: row.guest_email,
                guestPhone: row.guest_phone,
                guestCount: row.guest_count,
                roomsCount: row.rooms_count,
                totalAmount: Number(row.total_amount),
                status: row.booking_status,
            });

            grouped.set(vendor.id, group);
        }

        const dateLabel = this.formatDateLabel(today);
        if (grouped.size === 0) {
            logInfo("No owner check-in digest emails to send after filtering vendors.", { date: today });
        }

        const results = await Promise.allSettled(
            Array.from(grouped.values()).map((group) =>
                this.emailService.sendOwnerDailyCheckInsEmail({
                    to: group.email,
                    ownerName: group.ownerName,
                    dateLabel,
                    items: group.items,
                    metadata: {
                        date: today,
                        bookingCount: group.items.length,
                    },
                }),
            ),
        );

        const failedCount = results.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
            logError(
                new Error(`Some owner check-in digest emails failed. Failed: ${failedCount}/${results.length}. Date: ${today}`),
                "Owner check-in digest job",
            );
        } else {
            logInfo("Owner check-in digest emails sent.", {
                date: today,
                ownerCount: results.length,
            });
        }
    }
}
