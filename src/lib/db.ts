import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

/** Thrown when MONGODB_URI is missing so API routes can return a clear 503. */
export class DbNotConfiguredError extends Error {
  constructor() {
    super(
      "Database not configured. Add MONGODB_URI to the environment (.env.local in development) and restart the server."
    );
    this.name = "DbNotConfiguredError";
  }
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Cache the connection across hot reloads in development
const globalWithMongoose = global as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache = globalWithMongoose._mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose._mongoose = cache;

/** True when an error means the connection dropped mid-request (a network
 *  blip, a primary step-down) — worth one more try rather than a 500. */
export function isDeadConnectionError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /closed connection pool|session that has ended|Client must be connected|topolog\w* (was |is )?(closed|destroyed)|ECONNRESET|EPIPE|ETIMEDOUT|socket hang up|server monitor timeout|connection .{0,40}timed out|server selection timed out|not connected|pool .{0,40}(cleared|paused)|force closed|establishment was cancelled|stream .{0,20}(closed|destroyed)|network socket disconnected|other side closed|expired session|session was closed|interrupted at shutdown|operation was interrupted/i.test(
    m
  );
}

/** Run a DB-touching block with connect + retry on dropped-connection errors.
 *  For server components / layouts, which have no withApi wrapper — an
 *  uncaught driver error there crashes the whole page render. */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await connectDb();
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isDeadConnectionError(err)) throw err;
      // Jitter so simultaneous retries don't all land at once
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 300));
    }
  }
  throw lastErr;
}

export async function connectDb(): Promise<typeof mongoose> {
  if (!MONGODB_URI) throw new DbNotConfiguredError();

  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, { bufferCommands: false })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
