"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  HandCoins,
  Landmark,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Tabs } from "@/components/ui/Tabs";
import { DonationsTab } from "./DonationsTab";
import { FundsTab } from "./FundsTab";
import { PledgesTab } from "./PledgesTab";
import { StatementsTab } from "./StatementsTab";
import {
  MONTH_SHORT,
  type ChurchInfo,
  type FundDto,
  type GivingSummary,
} from "./types";

const TABS = [
  { value: "donations", label: "Donations" },
  { value: "funds", label: "Funds" },
  { value: "pledges", label: "Pledges" },
  { value: "statements", label: "Statements" },
];

function StatTile({
  icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <p className="truncate text-xl font-bold text-slate-900">{value}</p>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export default function GivingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const personFilter = searchParams.get("person") ?? "";

  const [tab, setTab] = useState("donations");
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [summary, setSummary] = useState<GivingSummary | null>(null);
  const [funds, setFunds] = useState<FundDto[] | null>(null);
  // Tagged with the id it was fetched for, so a stale name never shows
  const [personInfo, setPersonInfo] = useState<{ id: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  const currency = church?.currency ?? summary?.currency ?? "INR";
  const personName = personInfo?.id === personFilter ? personInfo.name : "";

  // Promise chains (not async/await) so every setState runs in a callback,
  // never synchronously inside the effect that triggers the load.
  const loadSummary = useCallback(() => {
    return api<GivingSummary>("/api/giving/summary")
      .then((data) => {
        setSummary(data);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : "Could not load giving.");
      });
  }, []);

  const loadFunds = useCallback(() => {
    return api<{ funds: FundDto[] }>("/api/giving/funds")
      .then((data) => setFunds(data.funds))
      .catch(() => setFunds([]));
  }, []);

  useEffect(() => {
    loadSummary();
    loadFunds();
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => setChurch(d.church))
      .catch(() => {});
  }, [loadSummary, loadFunds]);

  useEffect(() => {
    if (!personFilter) return;
    api<{ person: { name: string } }>(`/api/people/${personFilter}`)
      .then((d) => setPersonInfo({ id: personFilter, name: d.person.name }))
      .catch(() => {});
  }, [personFilter]);

  const refresh = useCallback(() => {
    loadSummary();
    loadFunds();
  }, [loadSummary, loadFunds]);

  const activeFunds = funds?.filter((f) => f.active).length ?? 0;
  const monthDelta =
    summary && summary.lastMonth.total > 0
      ? Math.round(
          ((summary.thisMonth.total - summary.lastMonth.total) / summary.lastMonth.total) * 100
        )
      : null;
  const maxMonth = Math.max(1, ...(summary?.byMonth.map((m) => m.total) ?? [0]));
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const fundTotal = summary?.byFund.reduce((s, f) => s + f.total, 0) ?? 0;

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Giving</h1>
          <p className="mt-1.5 text-slate-500">
            Tithes, offerings and designated gifts — receipts, funds, pledges and
            annual statements.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary ? (
          <>
            <StatTile
              icon={<CalendarDays className="h-5 w-5 text-indigo-600" aria-hidden />}
              tint="bg-indigo-50"
              label="This month"
              value={formatMoney(summary.thisMonth.total, currency)}
              hint={
                monthDelta === null ? (
                  `${summary.thisMonth.count} gift${summary.thisMonth.count === 1 ? "" : "s"}`
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 ${
                      monthDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {monthDelta >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {Math.abs(monthDelta)}% vs last month
                  </span>
                )
              }
            />
            <StatTile
              icon={<TrendingUp className="h-5 w-5 text-emerald-600" aria-hidden />}
              tint="bg-emerald-50"
              label={`This year (${summary.year})`}
              value={formatMoney(summary.thisYear.total, currency)}
              hint={`Last month ${formatMoney(summary.lastMonth.total, currency)}`}
            />
            <StatTile
              icon={<HandCoins className="h-5 w-5 text-amber-600" aria-hidden />}
              tint="bg-amber-50"
              label="Gifts this year"
              value={String(summary.thisYear.count)}
              hint={
                summary.thisYear.count > 0
                  ? `Avg ${formatMoney(
                      Math.round(summary.thisYear.total / summary.thisYear.count),
                      currency
                    )} per gift`
                  : "No gifts recorded yet"
              }
            />
            <StatTile
              icon={<Landmark className="h-5 w-5 text-sky-600" aria-hidden />}
              tint="bg-sky-50"
              label="Active funds"
              value={funds ? String(activeFunds) : "…"}
              hint={funds ? `${funds.length} in total` : undefined}
            />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[84px] animate-pulse rounded-2xl border border-slate-200 bg-white"
            />
          ))
        )}
      </div>

      {/* Chart + by fund */}
      {summary && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Giving by month · {summary.year}</h2>
              <p className="text-xs text-slate-500">
                Peak {formatMoney(Math.max(...summary.byMonth.map((m) => m.total)), currency)}
              </p>
            </div>
            <div className="mt-4 flex h-36 items-end gap-1.5 sm:gap-2">
              {summary.byMonth.map((m, i) => {
                const pct = (m.total / maxMonth) * 100;
                const isCurrent = m.month === currentMonthKey;
                return (
                  <div
                    key={m.month}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${MONTH_SHORT[i]}: ${formatMoney(m.total, currency)}`}
                  >
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-md transition-colors duration-200 ${
                          isCurrent
                            ? "bg-indigo-600"
                            : m.total > 0
                              ? "bg-indigo-200 group-hover:bg-indigo-400"
                              : "bg-slate-100"
                        }`}
                        style={{ height: `${Math.max(m.total > 0 ? 4 : 2, pct)}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isCurrent ? "text-indigo-600" : "text-slate-400"
                      }`}
                    >
                      {MONTH_SHORT[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">By fund · {summary.year}</h2>
            {summary.byFund.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Nothing received yet this year.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {summary.byFund.slice(0, 6).map((f) => {
                  const share = fundTotal > 0 ? Math.round((f.total / fundTotal) * 100) : 0;
                  return (
                    <li key={f.fundId}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-800">{f.fundName}</span>
                        <span className="shrink-0 font-semibold text-slate-900">
                          {formatMoney(f.total, currency)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] text-slate-400">
                          {share}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        {personFilter && (
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 py-1 pr-1.5 pl-3 text-xs font-semibold text-indigo-700">
            Showing gifts from {personName || "one person"}
            <button
              type="button"
              aria-label="Clear person filter"
              onClick={() => router.replace("/dashboard/giving")}
              className="cursor-pointer rounded-full p-0.5 transition-colors duration-200 hover:bg-indigo-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="mt-4">
        {tab === "donations" && (
          <DonationsTab
            currency={currency}
            funds={funds ?? []}
            personFilter={personFilter}
            personName={personName}
            onChanged={refresh}
          />
        )}
        {tab === "funds" && (
          <FundsTab
            funds={funds}
            currency={currency}
            year={summary?.year ?? String(new Date().getFullYear())}
            onChanged={refresh}
          />
        )}
        {tab === "pledges" && <PledgesTab funds={funds ?? []} currency={currency} />}
        {tab === "statements" && <StatementsTab currency={currency} />}
      </div>
    </div>
  );
}
