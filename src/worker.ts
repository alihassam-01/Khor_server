import "dotenv/config";
import { AppDataSource } from "@config/ormconfig";
import { CONFIG, validateProductionConfig } from "@config/config";
import { logError, logInfo } from "@lib/logger";
import { initJobs } from "@modules/user/jobs";

async function startWorker(): Promise<void> {
    validateProductionConfig();
    if (CONFIG.notifications.processRole !== "worker"
        && CONFIG.notifications.processRole !== "all") {
        throw new Error("Notification worker requires PROCESS_ROLE=worker or PROCESS_ROLE=all");
    }
    await AppDataSource.initialize();
    await AppDataSource.query("SELECT 1");
    initJobs();
    logInfo("Khor background worker started.");
}

startWorker().catch((error) => {
    logError(error, "Worker startup");
    process.exit(1);
});

