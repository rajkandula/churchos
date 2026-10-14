import { connectDb } from "@/lib/db";
import { dispatchDueAnnouncements } from "@/lib/announcement-dispatch";

/** How often the server looks for scheduled announcements that have come due. */
const TICK_MS = 5 * 60_000;

const globalWithScheduler = globalThis as typeof globalThis & {
  _announcementScheduler?: ReturnType<typeof setInterval>;
};

/**
 * Start the in-process scheduler: every five minutes, send the scheduled
 * announcements that have come due. Started once per server process from
 * src/instrumentation.ts.
 *
 * Several processes running this at once is safe: every announcement is
 * claimed with a conditional update before it is sent, so two ticks can never
 * send the same one twice. Set ANNOUNCEMENT_SCHEDULER=off to rely on an
 * external scheduler (POST /api/cron/dispatch-announcements) instead.
 */
export function startAnnouncementScheduler(): void {
  if (globalWithScheduler._announcementScheduler) return; // already running
  if (process.env.ANNOUNCEMENT_SCHEDULER === "off") return;
  if (!process.env.MONGODB_URI) return;

  let running = false;
  const tick = async () => {
    if (running) return; // a slow tick is still sending
    running = true;
    try {
      await connectDb();
      const { dispatched, failed } = await dispatchDueAnnouncements();
      if (dispatched || failed)
        console.log(`scheduled announcements: ${dispatched} sent, ${failed} failed`);
    } catch (err) {
      console.error("announcement scheduler tick failed:", err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, TICK_MS);
  // Never keep the process alive just for the scheduler.
  timer.unref?.();
  globalWithScheduler._announcementScheduler = timer;
}
