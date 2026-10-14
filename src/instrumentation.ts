/**
 * Runs once when a server process starts. Starts the in-process scheduler
 * that sends scheduled announcements (Node.js runtime only, never during
 * `next build`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startAnnouncementScheduler } = await import("./lib/announcement-scheduler");
  startAnnouncementScheduler();
}
