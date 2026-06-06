import { SimpleScheduler } from "@common/utils/scheduler";
import { SchedulePattern } from "@common/enums/scheduler.enum";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { BookingHoldJobService } from "../service/booking-hold-job.service";
import { BookingDailyEmailJobService } from "../service/booking-daily-email-job.service";
import { SubscriptionJobService } from "../service/subscription-job.service";
import { logInfo } from "@lib/logger";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();
    const bookingHoldJob = new BookingHoldJobService();
    const bookingDailyEmailJob = new BookingDailyEmailJobService();
    const subscriptionJob = new SubscriptionJobService();

    SimpleScheduler.schedule(SchedulePattern.MINUTELY, async () => {
        await bookingHoldJob.releaseExpiredHolds();
        await bookingHoldJob.expireExpiredPayments();
    });

    // Schedule monthly reports
    SimpleScheduler.schedule(SchedulePattern.MONTHLY, () => analyticsJob.generateAndSendReports(30));
    
    // Schedule daily ad expiration checks
    SimpleScheduler.schedule(SchedulePattern.DAILY, () => subscriptionJob.checkExpirations());

    // Schedule hotel owner arrival digests
    SimpleScheduler.scheduleDailyAt(6, 0, () => bookingDailyEmailJob.sendTodayOwnerCheckInDigests());

    logInfo("Background jobs initialized.");
};
