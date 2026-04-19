import { SimpleScheduler } from "@common/utils/scheduler";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { logInfo } from "@lib/logger";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();

    // Schedule daily reports (Checks every hour, runs every night at 01:00 AM)
    SimpleScheduler.schedule('daily', () => analyticsJob.generateAndSendReports(1));
    
    logInfo("Background jobs initialized.");
};
