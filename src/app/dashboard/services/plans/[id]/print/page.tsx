"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { PrintButton } from "@/components/PrintButton";
import {
  DEFAULT_SERVICE_START,
  ITEM_TYPE_LABELS,
  VOLUNTEER_STATUS_LABELS,
  addMinutes,
  formatClock,
  formatDuration,
  totalMinutes,
  type ChurchInfo,
  type PlanDto,
  type PlanVolunteerDto,
} from "../../../types";

/** Printable run sheet — letterhead, timed running order, roster by team. */
export default function PrintRunSheetPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  // No Service record links a start time to a plan yet — default 09:00.
  const [start, setStart] = useState(DEFAULT_SERVICE_START);

  useEffect(() => {
    api<{ plan: PlanDto }>(`/api/services/plans/${id}`)
      .then((d) => setPlan(d.plan))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Could not load this plan.")
      );
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => setChurch(d.church))
      .catch(() => setChurch(null));
  }, [id]);

  const timed = useMemo(() => {
    if (!plan) return [];
    let clock = start || DEFAULT_SERVICE_START;
    return plan.items.map((it) => {
      const at = clock;
      clock = addMinutes(clock, it.durationMin);
      return { ...it, at };
    });
  }, [plan, start]);

  const byTeam = useMemo(() => {
    const map = new Map<string, PlanVolunteerDto[]>();
    for (const v of plan?.volunteers ?? []) {
      if (!v.person) continue;
      const key = v.teamName || "Team";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [plan]);

  const total = plan ? totalMinutes(plan.items) : 0;
  const endsAt = addMinutes(start || DEFAULT_SERVICE_START, total);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/services/plans/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to plan
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
            Starts at
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value || DEFAULT_SERVICE_START)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
            />
          </label>
          <PrintButton />
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden"
        >
          {loadError}
        </div>
      )}

      {!plan && !loadError && (
        <div className="mt-6 h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      )}

      {plan && (
        <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm print:mt-0 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Letterhead */}
          <header className="flex items-start gap-4 border-b-2 border-slate-900 pb-5">
            {church?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={church.logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-contain"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold tracking-tight">{church?.name ?? " "}</p>
              {church?.address && <p className="text-sm text-slate-600">{church.address}</p>}
              {(church?.phone || church?.email) && (
                <p className="text-xs text-slate-500">
                  {[church.phone, church.email].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                Run sheet
              </p>
              <p className="text-sm font-semibold capitalize">{plan.status}</p>
            </div>
          </header>

          <section className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight">{plan.title}</h1>
            <p className="mt-1 text-slate-600">
              {formatDate(plan.date)} · {formatClock(start || DEFAULT_SERVICE_START)} –{" "}
              {formatClock(endsAt)} ({formatDuration(total)})
            </p>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
              {plan.theme && (
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Theme</dt>
                  <dd className="font-medium">{plan.theme}</dd>
                </div>
              )}
              {plan.scripture && (
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Scripture</dt>
                  <dd className="font-medium">{plan.scripture}</dd>
                </div>
              )}
              {plan.preacherName && (
                <div>
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Preacher</dt>
                  <dd className="font-medium">{plan.preacherName}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="mt-6">
            <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">
              Order of service
            </h2>
            {plan.items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No items planned.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-3 w-20">Time</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Detail</th>
                    <th className="py-2 pr-3">Led by</th>
                    <th className="py-2 text-right w-14">Min</th>
                  </tr>
                </thead>
                <tbody>
                  {timed.map((it, i) => (
                    <tr key={it._id ?? i} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-mono text-xs tabular-nums text-slate-600">
                        {formatClock(it.at)}
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-semibold">{it.title}</p>
                        <p className="text-xs text-slate-500">{ITEM_TYPE_LABELS[it.type]}</p>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{it.detail || ""}</td>
                      <td className="py-2 pr-3 text-slate-700">{it.ownerName || ""}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{it.durationMin}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-3 font-mono text-xs tabular-nums text-slate-600">
                      {formatClock(endsAt)}
                    </td>
                    <td colSpan={3} className="py-2 pr-3 font-semibold">
                      Close
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{total}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          <section className="mt-6 break-inside-avoid">
            <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">
              Serving today
            </h2>
            {byTeam.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No volunteers scheduled.</p>
            ) : (
              <div className="mt-2 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                {byTeam.map(([team, list]) => (
                  <div key={team} className="break-inside-avoid">
                    <p className="border-b border-slate-200 pb-1 font-semibold">{team}</p>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {list.map((v, i) => (
                        <li key={v._id ?? i} className="flex items-baseline justify-between gap-3">
                          <span>
                            <span className="text-slate-500">{v.role ? `${v.role}: ` : ""}</span>
                            <span className="font-medium">{v.personName}</span>
                          </span>
                          <span className="text-xs text-slate-400">
                            {v.status === "confirmed" ? "✓" : VOLUNTEER_STATUS_LABELS[v.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {plan.notes && (
            <section className="mt-6 break-inside-avoid">
              <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">Notes</h2>
              <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{plan.notes}</p>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
