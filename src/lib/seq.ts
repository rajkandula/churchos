/**
 * Run a create callback up to five times, retrying on Mongo duplicate-key
 * errors — used for human-friendly sequential numbers (member numbers,
 * receipts, certificate serials) that can race under concurrent writes.
 */
export async function withSeqRetry<T>(
  create: (attempt: number) => Promise<T>
): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await create(attempt);
    } catch (err) {
      const isDuplicate =
        typeof err === "object" &&
        err !== null &&
        (err as { code?: number }).code === 11000;
      if (!isDuplicate) throw err;
    }
  }
  return null;
}

/** Zero-padded sequence label — seqLabel("P", 7) → "P-0007". */
export function seqLabel(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/** Calendar year as a string — giving statements are per calendar year. */
export function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Indian financial year, e.g. "2026-27" (rolls over in April). */
export function currentFinancialYear(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
