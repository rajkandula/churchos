import { Types } from "mongoose";
import { Fund } from "@/models/Fund";
import { Donation } from "@/models/Donation";
import { Church } from "@/models/Church";
import { DEFAULT_FUNDS, PAYMENT_MODES } from "@/lib/constants";
import { isValidObjectId } from "@/lib/person-fields";
import { seqLabel } from "@/lib/seq";

/** Calendar year of a stored date — dates are UTC midnight, so read UTC. */
export function yearOf(date: Date): string {
  return String(date.getUTCFullYear());
}

/** Parse a date input ("2026-01-31" or ISO) — null when invalid/empty. */
export function parseDate(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPaymentMode(value: string): boolean {
  return (PAYMENT_MODES as readonly string[]).includes(value);
}

/** Search/filter params from the Donations list → a Mongo filter.
 *  Ids are real ObjectIds so the same filter works in find() and in an
 *  aggregate $match (which does no casting). */
export function buildDonationFilter(
  params: URLSearchParams,
  churchId: string
): Record<string, unknown> {
  const filter: Record<string, unknown> = { churchId: new Types.ObjectId(churchId) };

  const q = (params.get("q") ?? "").trim();
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ personName: re }, { receiptNo: re }, { reference: re }];
  }
  const fund = (params.get("fund") ?? "").trim();
  if (fund && isValidObjectId(fund)) filter.fund = new Types.ObjectId(fund);
  const person = (params.get("person") ?? "").trim();
  if (person && isValidObjectId(person)) filter.person = new Types.ObjectId(person);
  const mode = (params.get("mode") ?? "").trim();
  if (mode && isPaymentMode(mode)) filter.mode = mode;
  const year = (params.get("year") ?? "").trim();
  if (/^\d{4}$/.test(year)) filter.year = year;

  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = from;
    if (to) {
      // "to" is inclusive of the whole day
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      range.$lte = end;
    }
    filter.date = range;
  }
  return filter;
}

/** Seed the starter funds for a church that has none yet (idempotent). */
export async function ensureDefaultFunds(
  churchId: string,
  userId?: string
): Promise<void> {
  const count = await Fund.countDocuments({ churchId });
  if (count > 0) return;
  try {
    await Fund.insertMany(
      DEFAULT_FUNDS.map((f) => ({
        churchId,
        name: f.name,
        description: f.description,
        active: true,
        createdBy: userId && isValidObjectId(userId) ? new Types.ObjectId(userId) : undefined,
      })),
      { ordered: false }
    );
  } catch (err) {
    // A concurrent first request may have seeded already — the unique
    // index rejects the duplicates and that is fine.
    if ((err as { code?: number }).code !== 11000) throw err;
  }
}

/** Next receipt number — survives deleted receipts by reading the latest. */
export async function nextReceiptNo(churchId: string, attempt: number): Promise<string> {
  const [count, latest] = await Promise.all([
    Donation.countDocuments({ churchId }),
    Donation.findOne({ churchId }).sort({ createdAt: -1 }).select("receiptNo").lean(),
  ]);
  const lastSeq = Number((latest?.receiptNo ?? "").replace(/\D/g, "")) || 0;
  return seqLabel("R", Math.max(count, lastSeq) + 1 + attempt);
}

/** The church's currency code, defaulting to INR. */
export async function churchCurrency(churchId: string): Promise<string> {
  const church = await Church.findById(churchId).select("currency").lean();
  return church?.currency || "INR";
}

/** Plain-JSON shape for a donation the client can render. */
export function shapeDonation(d: {
  _id: unknown;
  receiptNo: string;
  person?: unknown;
  personName?: string;
  fund: unknown;
  fundName?: string;
  amount: number;
  mode?: string;
  date: Date;
  reference?: string;
  note?: string;
  year?: string;
  createdAt?: Date;
}) {
  return {
    _id: String(d._id),
    receiptNo: d.receiptNo,
    person: d.person ? String(d.person) : null,
    personName: d.personName || "Anonymous",
    fund: String(d.fund),
    fundName: d.fundName ?? "",
    amount: d.amount,
    mode: d.mode ?? "Cash",
    date: d.date,
    reference: d.reference ?? "",
    note: d.note ?? "",
    year: d.year ?? yearOf(d.date),
    createdAt: d.createdAt,
  };
}
