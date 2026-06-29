import { SimpleScheduler } from "@common/utils/scheduler";
import { SchedulePattern } from "@common/enums/scheduler.enum";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { BookingBillDailyDigestJobService } from "../service/booking-bill-daily-digest-job.service";
import { BookingHoldJobService } from "../service/booking-hold-job.service";
import { BookingDailyEmailJobService } from "../service/booking-daily-email-job.service";
import { SubscriptionJobService } from "../service/subscription-job.service";
import { logInfo } from "@lib/logger";
import { NotificationOutboxWorkerService } from "../service/notification-outbox-worker.service";
import { BookingDailyWhatsAppJobService } from "../service/booking-daily-whatsapp-job.service";
import { CONFIG } from "@config/config";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();
    const bookingHoldJob = new BookingHoldJobService();
    const bookingBillDailyDigestJob = new BookingBillDailyDigestJobService();
    const bookingDailyEmailJob = new BookingDailyEmailJobService();
    const subscriptionJob = new SubscriptionJobService();
    const notificationWorker = new NotificationOutboxWorkerService();
    const bookingDailyWhatsAppJob = new BookingDailyWhatsAppJobService();

    SimpleScheduler.schedule(SchedulePattern.MINUTELY, async () => {
        await bookingHoldJob.releaseExpiredHolds();
        await bookingHoldJob.expireExpiredPayments();
        await notificationWorker.processDue();
    });

    // Schedule monthly reports
    SimpleScheduler.schedule(SchedulePattern.MONTHLY, () => analyticsJob.generateAndSendReports(30));
    
    // Schedule daily ad expiration checks
    SimpleScheduler.schedule(SchedulePattern.DAILY, () => subscriptionJob.checkExpirations());

    // Schedule hotel owner arrival digests
    SimpleScheduler.scheduleDailyAt(8, 0, async () => {
        await bookingDailyEmailJob.sendTodayOwnerCheckInDigests();
        await bookingDailyWhatsAppJob.enqueueTodayOwnerCheckInDigests();
    }, CONFIG.notifications.timezone);

    // Schedule customer extra-bill digests shortly after local midnight.
    SimpleScheduler.scheduleDailyAt(0, 5, async () => {
        await bookingBillDailyDigestJob.sendPendingCustomerBillDigests();
    }, CONFIG.notifications.timezone);

    logInfo("Background jobs initialized.");
};
