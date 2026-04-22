import { SimpleScheduler } from "@common/utils/scheduler";
import { SchedulePattern } from "@common/enums/scheduler.enum";
import { AnalyticsJobService } from "../service/analytics-job.service";
import { logInfo } from "@lib/logger";

export const initJobs = () => {
    logInfo("Initializing background jobs...");

    const analyticsJob = new AnalyticsJobService();

    // Schedule monthly reports
    SimpleScheduler.schedule(SchedulePattern.MONTHLY, () => analyticsJob.generateAndSendReports(30));
    
    logInfo("Background jobs initialized.");
};
