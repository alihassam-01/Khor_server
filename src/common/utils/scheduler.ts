import { logInfo } from "@lib/logger";
import { SchedulePattern } from "@common/enums/scheduler.enum";

type Task = () => Promise<void> | void;
type ScheduledTask = {
    pattern: SchedulePattern;
    task: Task;
    hour?: number;
    minute?: number;
    lastRun?: Date;
};

export class SimpleScheduler {
    private static tasks: ScheduledTask[] = [];
    private static interval: any = null;

    /**
     * Minimal scheduler that checks every minute.
     * Less frequent tasks are still guarded by their pattern checks.
     */
    static schedule(pattern: SchedulePattern, task: Task) {
        this.tasks.push({ pattern, task });
        logInfo(`Task scheduled with pattern: ${pattern}`);

        if (!this.interval) {
            this.start();
        }
    }

    static scheduleDailyAt(hour: number, minute: number, task: Task) {
        this.tasks.push({ pattern: SchedulePattern.DAILY, task, hour, minute });
        logInfo(`Task scheduled daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);

        if (!this.interval) {
            this.start();
        }
    }

    private static start() {
        this.interval = setInterval(() => this.check(), 60 * 1000);
        // Also check immediately on start
        this.check();
    }

    private static async check() {
        const now = new Date();
        const day = now.getDay(); // 0-6 (Sunday is 0)
        const date = now.getDate(); // 1-31
        const hour = now.getHours();
        const minute = now.getMinutes();

        for (const item of this.tasks) {
            let shouldRun = false;

            if (item.pattern === SchedulePattern.MINUTELY) {
                shouldRun = true;
            } else if (item.pattern === SchedulePattern.DAILY) {
                const targetHour = item.hour ?? 1;
                const targetMinute = item.minute ?? 0;
                if (hour === targetHour && minute === targetMinute) {
                    shouldRun = true;
                }
            } else if (item.pattern === SchedulePattern.WEEKLY) {
                // Run on Monday (1) between 00:00 and 01:00
                if (day === 1 && hour === 0 && minute === 0) {
                    shouldRun = true;
                }
            } else if (item.pattern === SchedulePattern.MONTHLY) {
                // Run on 1st of month between 00:00 and 01:00
                if (date === 1 && hour === 0 && minute === 0) {
                    shouldRun = true;
                }
            }

            if (shouldRun) {
                const runKey = item.pattern === SchedulePattern.MINUTELY
                    ? `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}-${minute}`
                    : item.pattern === SchedulePattern.DAILY
                        ? `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
                        : item.pattern === SchedulePattern.WEEKLY
                            ? `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${day}`
                            : `${now.getFullYear()}-${now.getMonth()}-1`;

                const lastRunKey = item.lastRun
                    ? item.pattern === SchedulePattern.MINUTELY
                        ? `${item.lastRun.getFullYear()}-${item.lastRun.getMonth()}-${item.lastRun.getDate()}-${item.lastRun.getHours()}-${item.lastRun.getMinutes()}`
                        : item.pattern === SchedulePattern.DAILY
                            ? `${item.lastRun.getFullYear()}-${item.lastRun.getMonth()}-${item.lastRun.getDate()}`
                            : item.pattern === SchedulePattern.WEEKLY
                                ? `${item.lastRun.getFullYear()}-${item.lastRun.getMonth()}-${item.lastRun.getDate()}-${item.lastRun.getDay()}`
                                : `${item.lastRun.getFullYear()}-${item.lastRun.getMonth()}-1`
                    : null;

                if (lastRunKey !== runKey) {
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
