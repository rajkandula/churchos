"use client";

import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/Avatar";
import { PersonPicker, type PickedPerson } from "@/components/PersonPicker";
import { selectClass, yearOptions, type GiverRow } from "./types";

export function StatementsTab({ currency }: { currency: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [person, setPerson] = useState<PickedPerson | null>(null);
  // Rows are tagged with the year they belong to, so switching years shows
  // the skeleton until the new list arrives — without a synchronous reset.
  const [loaded, setLoaded] = useState<{ year: string; givers: GiverRow[] } | null>(null);
  const [loadError, setLoadError] = useState("");
  const givers = loaded?.year === year ? loaded.givers : null;

  // Promise chain (not async/await) so every setState runs in a callback,
  // never synchronously inside the effect that triggers the load.
  const load = useCallback(() => {
    return api<{ givers: GiverRow[] }>(`/api/giving/givers?year=${year}`)
      .then((data) => {
        setLoaded({ year, givers: data.givers });
        setLoadError("");
      })
      .catch((err: unknown) => {
        setLoaded({ year, givers: [] });
        setLoadError(err instanceof Error ? err.message : "Could not load givers.");
      });
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const statementUrl = (personId: string) =>
    `/dashboard/giving/statements/${personId}/print?year=${year}`;

  const grand = givers?.reduce((s, g) => s + g.total, 0) ?? 0;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Open a statement</h2>
        <p className="mt-1 text-sm text-slate-500">
          An annual giving statement lists every receipted gift from one person in a calendar
          year — print it or save as PDF.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Statement year"
            className={selectClass}
          >
            {yearOptions(6).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="min-w-64 flex-1">
            <PersonPicker value={person} onChange={setPerson} />
          </div>
          <Button
            disabled={!person}
            onClick={() => person && window.open(statementUrl(person._id), "_blank")}
          >
            <FileText className="h-4 w-4" aria-hidden />
            Open statement
          </Button>
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-900">Everyone who gave in {year}</h2>
          {givers && givers.length > 0 && (
            <p className="text-xs text-slate-500">
              {givers.length} giver{givers.length === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold text-slate-800">{formatMoney(grand, currency)}</span>
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Giver</th>
                <th className="px-4 py-3.5 text-right">Gifts</th>
                <th className="px-4 py-3.5">Last gift</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5 text-right">Statement</th>
              </tr>
            </thead>
            <tbody>
              {givers === null &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {givers?.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <Users className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">
                        No linked gifts in {year}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Anonymous gifts don&apos;t appear here — only donations linked to a person
                        can be issued a statement.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {givers?.map((g) => (
                <tr
                  key={g.person}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/people/${g.person}`} className="flex items-center gap-3">
                      <Avatar name={g.personName} />
                      <span className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                        {g.personName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{g.count}</td>
                  <td className="px-4 py-3.5 text-slate-600">{formatDate(g.lastDate)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                    {formatMoney(g.total, currency)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={statementUrl(g.person)}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      Statement
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
