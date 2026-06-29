import {
    NotificationChannel,
    NotificationOutboxStatus,
} from "@common/enums/notification.enums";
import { CONFIG } from "@config/config";
import { AppDataSource } from "@config/ormconfig";
import { normalizePhoneToE164 } from "@common/utils/phone.util";
import {
    BookingBillItem,
    BookingBill,
    HotelBooking,
} from "@modules/user/entity/booking";
import { NotificationOutbox } from "@modules/user/entity/user";
import { SendEmail } from "./email/sendEmail";
import { logInfo } from "@lib/logger";

type BillItemRow = BookingBillItem & {
    bill: BookingBill & {
        booking: HotelBooking & {
            listing: HotelBooking["listing"] & {
                contact?: NonNullable<HotelBooking["listing"]>["contact"];
            };
        };
    };
};

export class BookingBillDailyDigestJobService {
    private readonly itemRepo = AppDataSource.getRepository(BookingBillItem);
    private readonly emailService = new SendEmail();

    private getLocalDateKey(value: Date): string {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: CONFIG.notifications.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(value);
        const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return `${date.year}-${date.month}-${date.day}`;
    }

    private getTodayLocalDate(): string {
        return this.getLocalDateKey(new Date());
    }

    private formatDateLabel(date: string): string {
        return new Intl.DateTimeFormat("en-PK", {
            dateStyle: "full",
            timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00.000Z`));
    }

    async sendPendingCustomerBillDigests(): Promise<void> {
        const rows = await this.itemRepo.createQueryBuilder("item")
            .leftJoinAndSelect("item.bill", "bill")
            .leftJoinAndSelect("bill.booking", "booking")
            .leftJoinAndSelect("booking.listing", "listing")
            .leftJoinAndSelect("listing.contact", "contact")
            .where("item.daily_digest_sent_at IS NULL")
            .orderBy("item.created_at", "ASC")
            .getMany() as unknown as BillItemRow[];

        if (rows.length === 0) {
            logInfo("No pending booking bill digests to send.");
            return;
        }

        const todayLocalDate = this.getTodayLocalDate();
        const groups = new Map<string, {
            bookingId: string;
            bookingNumber: string;
            customerName: string;
            customerEmail: string | null;
            customerPhone: string | null;
            hotelName: string;
            currency: string;
            localDate: string;
            itemIds: string[];
            items: Array<{ itemName: string; amount: number }>;
            totalAmount: number;
        }>();

        for (const row of rows) {
            const localDate = this.getLocalDateKey(new Date(row.created_at));
            if (localDate >= todayLocalDate) {
                continue;
            }

            const booking = row.bill.booking;
            const key = `${booking.id}:${localDate}`;
            const current = groups.get(key) ?? {
                bookingId: booking.id,
                bookingNumber: booking.booking_number,
                customerName: booking.guest_name,
                customerEmail: booking.guest_email ?? null,
                customerPhone: booking.guest_phone ?? null,
                hotelName: booking.listing.name,
                currency: row.bill.currency,
                localDate,
                itemIds: [],
                items: [],
                totalAmount: 0,
            };
            current.itemIds.push(row.id);
            current.items.push({
                itemName: row.item_name,
                amount: Number(row.amount),
            });
            current.totalAmount += Number(row.amount);
            groups.set(key, current);
        }

        if (groups.size === 0) {
            logInfo("No booking bill digests are due yet.");
            return;
        }

        let sentCount = 0;
        for (const group of groups.values()) {
            const dateLabel = this.formatDateLabel(group.localDate);
            const emailResult = group.customerEmail
                ? await this.emailService.sendBookingBillDailyDigestEmail({
                    to: group.customerEmail,
                    customerName: group.customerName,
                    hotelName: group.hotelName,
                    bookingNumber: group.bookingNumber,
                    dateLabel,
                    currency: group.currency,
                    items: group.items,
                    totalAmount: group.totalAmount,
                    metadata: {
                        bookingId: group.bookingId,
                        localDate: group.localDate,
                        itemCount: group.items.length,
                    },
                })
                : { status: "ok" as const };

            if (CONFIG.notifications.whatsappEnabled) {
                const destination = normalizePhoneToE164(group.customerPhone);
                if (destination) {
                    await AppDataSource.createQueryBuilder()
                        .insert()
                        .into(NotificationOutbox)
                        .values({
                            event_key: `booking-bill-digest:${group.bookingId}:${group.localDate}:customer:whatsapp`,
                            channel: NotificationChannel.WHATSAPP,
                            event_type: "booking.bill_daily_digest",
                            recipient_type: "customer",
                            booking_id: group.bookingId,
                            destination,
                            template_key: "booking_bill_daily_digest_v1",
                            payload: {
                                recipientName: group.customerName,
                                bookingNumber: group.bookingNumber,
                                hotelName: group.hotelName,
                                dateLabel,
                                currency: group.currency,
                                totalAmount: group.totalAmount,
                                items: group.items,
                            },
                            status: NotificationOutboxStatus.PENDING,
                            attempt_count: 0,
                            next_attempt_at: new Date(),
                        })
                        .orIgnore()
                        .execute();
                }
            }

            if (emailResult.status !== "ok" && group.customerEmail) {
                continue;
            }

            await this.itemRepo.createQueryBuilder()
                .update(BookingBillItem)
                .set({ daily_digest_sent_at: () => "NOW()" })
                .where("id IN (:...ids)", { ids: group.itemIds })
                .execute();
            sentCount += 1;
        }

        logInfo("Processed booking bill digests.", {
            dueGroups: groups.size,
            markedSentGroups: sentCount,
        });
    }
}

