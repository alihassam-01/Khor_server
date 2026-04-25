import { SimpleScheduler } from "@common/utils/scheduler";
import { SchedulePattern } from "@common/enums/scheduler.enum";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { SubscriptionJobService } from "../service/subscription-job.service";
import { logInfo } from "@lib/logger";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();
    const subscriptionJob = new SubscriptionJobService();

    // Schedule monthly reports
    SimpleScheduler.schedule(SchedulePattern.MONTHLY, () => analyticsJob.generateAndSendReports(30));
    
    // Schedule daily ad expiration checks
    SimpleScheduler.schedule(SchedulePattern.DAILY, () => subscriptionJob.checkExpirations());

    logInfo("Background jobs initialized.");
};
