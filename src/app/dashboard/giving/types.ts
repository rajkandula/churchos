export type ChurchInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  currency: string;
  code?: string;
};

export type FundDto = {
  _id: string;
  name: string;
  description: string;
  active: boolean;
  /** Received this calendar year */
  total: number;
  count: number;
  createdAt?: string;
};

export type DonationDto = {
  _id: string;
  receiptNo: string;
  person: string | null;
  personName: string;
  fund: string;
  fundName: string;
  amount: number;
  mode: string;
  date: string;
  reference: string;
  note: string;
  year: string;
  createdAt?: string;
};

export type PledgeDto = {
  _id: string;
  person: string;
  personName: string;
  fund: string | null;
  fundName: string;
  amount: number;
  frequency: PledgeFrequency;
  startDate: string | null;
  endDate: string | null;
  note: string;
  status: PledgeStatus;
  given: number;
  progress: number;
  createdAt?: string;
};

export type GivingSummary = {
  year: string;
  currency: string;
  thisMonth: { total: number; count: number };
  thisYear: { total: number; count: number };
  lastMonth: { total: number };
  byFund: { fundId: string; fundName: string; total: number }[];
  byMonth: { month: string; total: number }[];
  topGivers: { person: string; personName: string; total: number }[];
  recentDonations: DonationDto[];
};

export type GiverRow = {
  person: string;
  personName: string;
  total: number;
  count: number;
  lastDate: string;
};

export type StatementData = {
  church: ChurchInfo;
  person: {
    _id: string;
    name: string;
    memberNo: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
  };
  year: string;
  donations: DonationDto[];
  total: number;
  count: number;
  byFund: { fundId: string; fundName: string; total: number; count: number }[];
};

export const PLEDGE_FREQUENCIES = ["one-time", "weekly", "monthly", "yearly"] as const;
export type PledgeFrequency = (typeof PLEDGE_FREQUENCIES)[number];
export const PLEDGE_FREQUENCY_LABELS: Record<PledgeFrequency, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const PLEDGE_STATUSES = ["active", "fulfilled", "cancelled"] as const;
export type PledgeStatus = (typeof PLEDGE_STATUSES)[number];
export const PLEDGE_STATUS_LABELS: Record<PledgeStatus, string> = {
  active: "Active",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};
export const PLEDGE_STATUS_STYLES: Record<PledgeStatus, string> = {
  active: "bg-sky-50 text-sky-700 border-sky-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export const MODE_STYLES: Record<string, string> = {
  Cash: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  UPI: "bg-violet-50 text-violet-700 ring-violet-600/20",
  Card: "bg-sky-50 text-sky-700 ring-sky-600/20",
  Cheque: "bg-amber-50 text-amber-700 ring-amber-600/20",
  "Bank transfer": "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  Online: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

export const iconButtonClass =
  "cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700";

/** Today as an <input type="date"> value, in the viewer's local calendar. */
export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** The current year and a few before it, for statement pickers. */
export function yearOptions(back = 5): string[] {
  const y = new Date().getFullYear();
  return Array.from({ length: back + 1 }, (_, i) => String(y - i));
}

/** Long date for printed documents — "2 September 2026". */
export function formatLongDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
