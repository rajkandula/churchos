"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { PrintButton } from "@/components/PrintButton";
import { Letterhead, PrintStyles } from "../../../Letterhead";
import { formatLongDate, type StatementData } from "../../../types";

export default function StatementPrintPage() {
  const { personId } = useParams<{ personId: string }>();
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? String(new Date().getFullYear());
  const [data, setData] = useState<StatementData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<StatementData>(`/api/giving/statement/${personId}?year=${encodeURIComponent(year)}`)
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load this statement.")
      );
  }, [personId, year]);

  const currency = data?.church.currency ?? "INR";
  const personAddress = data
    ? [data.person.address, data.person.city, data.person.state, data.person.pincode]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="animate-fade-up">
      <PrintStyles />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/giving"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Giving
        </Link>
        <PrintButton />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden"
        >
          {error}
        </div>
      )}

      <article className="mx-auto mt-5 max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <Letterhead church={data?.church ?? null} />

        {data ? (
          <>
            <div className="mt-8">
              <p className="text-xs font-bold tracking-[0.2em] text-indigo-600 uppercase">
                Annual giving statement
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Giving statement for {data.year}
              </h1>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Issued to
                </p>
                <p className="mt-1 font-bold text-slate-900">{data.person.name}</p>
                <p className="text-xs text-slate-500">{data.person.memberNo}</p>
                {personAddress && (
                  <p className="mt-1.5 text-sm text-slate-600">{personAddress}</p>
                )}
                {(data.person.phone || data.person.email) && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[data.person.phone, data.person.email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 print:border-slate-300 print:bg-transparent">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Total given in {data.year}
                </p>
                <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">
                  {formatMoney(data.total, currency)}
                </p>
                <p className="text-xs text-slate-500">
                  {data.count} gift{data.count === 1 ? "" : "s"} across {data.byFund.length} fund
                  {data.byFund.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {/* Donations */}
            <h2 className="mt-8 text-sm font-bold text-slate-900">Donations</h2>
            {data.donations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No receipted gifts were recorded for {data.year}.
              </p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Receipt</th>
                    <th className="py-2 pr-3">Fund</th>
                    <th className="py-2 pr-3">Mode</th>
                    <th className="py-2 pr-3">Reference</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.donations.map((d) => (
                    <tr key={d._id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-700">{formatDate(d.date)}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-600">{d.receiptNo}</td>
                      <td className="py-2 pr-3 text-slate-700">{d.fundName}</td>
                      <td className="py-2 pr-3 text-slate-600">{d.mode}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{d.reference || "—"}</td>
                      <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">
                        {formatMoney(d.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* By fund */}
            {data.byFund.length > 0 && (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_16rem]">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Totals by fund</h2>
                  <table className="mt-2 w-full text-left text-sm">
                    <tbody>
                      {data.byFund.map((f) => (
                        <tr key={f.fundId} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-700">
                            {f.fundName}
                            <span className="ml-2 text-xs text-slate-400">
                              {f.count} gift{f.count === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">
                            {formatMoney(f.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between border-t-2 border-slate-900 pt-3">
                    <span className="text-sm font-bold tracking-wide text-slate-900 uppercase">
                      Grand total
                    </span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      {formatMoney(data.total, currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-8 text-sm leading-relaxed text-slate-600">
              Thank you, {data.person.name.split(/\s+/)[0]}, for your faithful giving to{" "}
              {data.church.name} in {data.year}. Your generosity supports the ministry and
              mission of the church.
            </p>

            <div className="mt-12 flex items-end justify-between">
              <p className="text-[11px] text-slate-400">
                This statement is generated from records as of {formatLongDate(new Date())}.
              </p>
              <div className="w-56 text-center">
                <div className="border-t border-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Treasurer</p>
              </div>
            </div>
          </>
        ) : (
          !error && (
            <div className="mt-8 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          )
        )}
      </article>
    </div>
  );
}
