import { SimpleScheduler } from "@common/utils/scheduler";
import { SchedulePattern } from "@common/enums/scheduler.enum";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { logInfo } from "@lib/logger";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();

    // Schedule daily reports (Checks every hour, runs every night at 01:00 AM)
    SimpleScheduler.schedule(SchedulePattern.DAILY, () => analyticsJob.generateAndSendReports(1));
    
    logInfo("Background jobs initialized.");
};
