import { logInfo } from "@lib/logger";

type Task = () => Promise<void> | void;

export class SimpleScheduler {
    private static tasks: { pattern: string; task: Task; lastRun?: Date }[] = [];
    private static interval: any = null;

    /**
     * Minimal scheduler that checks every hour
     * pattern: 'daily' | 'weekly' | 'monthly'
     */
    static schedule(pattern: 'daily' | 'weekly' | 'monthly', task: Task) {
        this.tasks.push({ pattern, task });
        logInfo(`Task scheduled with pattern: ${pattern}`);

        if (!this.interval) {
            this.start();
        }
    }

    private static start() {
        // Check every hour
        this.interval = setInterval(() => this.check(), 60 * 60 * 1000);
        // Also check immediately on start
        this.check();
    }

    private static async check() {
        const now = new Date();
        const day = now.getDay(); // 0-6 (Sunday is 0)
        const date = now.getDate(); // 1-31
        const hour = now.getHours();

        for (const item of this.tasks) {
            let shouldRun = false;

            if (item.pattern === 'daily') {
                // Run every day between 01:00 and 02:00
                if (hour === 1) {
                    shouldRun = true;
                }
            } else if (item.pattern === 'weekly') {
                // Run on Monday (1) between 00:00 and 01:00
                if (day === 1 && hour === 0) {
                    shouldRun = true;
                }
            } else if (item.pattern === 'monthly') {
                // Run on 1st of month between 00:00 and 01:00
                if (date === 1 && hour === 0) {
                    shouldRun = true;
                }
            }

            if (shouldRun) {
                // Avoid running multiple times in the same hour window
                const todayStr = now.toDateString();
                if (item.lastRun?.toDateString() !== todayStr) {
                    logInfo(`Running scheduled task: ${item.pattern}`);
                    item.lastRun = now;
                    try {
                        await item.task();
                    } catch (err) {
                        console.error(`Scheduled task failed:`, err);
                    }
                }
            }
        }
    }
}
