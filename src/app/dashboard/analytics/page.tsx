"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Cake,
  CalendarDays,
  ClipboardCheck,
  FileBadge,
  HandHeart,
  HeartHandshake,
  ListMusic,
  Megaphone,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { Avatar } from "@/components/Avatar";

type Analytics = {
  year: string;
  currency: string;
  churchName: string;
  people: {
    total: number;
    byStatus: Record<string, number>;
    newLast30: number;
    households: number;
    genders: Record<string, number>;
    birthdays: { _id: string; name: string; photoUrl: string; on: string }[];
  };
  giving: {
    thisYear: { total: number; count: number };
    thisMonth: { total: number; count: number };
    lastMonth: { total: number; count: number };
    byMonth: { month: string; total: number }[];
    byFund: { fundName: string; total: number }[];
    givers: number;
  };
  attendance: {
    trend: { date: string; serviceName: string; headcount: number }[];
    avgHeadcount: number | null;
    last: { date: string; serviceName: string; headcount: number } | null;
    checkinsToday: number;
  };
  groups: { active: number; peopleInGroups: number };
  events: {
    _id: string;
    title: string;
    startAt: string;
    venue: string;
    capacity: number | null;
    registered: number;
  }[];
  connect: { byStatus: Record<string, number>; thisMonth: number };
  services: {
    _id: string;
    date: string;
    title: string;
    theme: string;
    preacherName: string;
    items: number;
    volunteers: number;
    confirmed: number;
    status: string;
  } | null;
  activity: { announcements: number; certificates: number; staff: number };
};

const CONNECT_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  "visited-again": "Visited again",
  joined: "Joined",
  closed: "Closed",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api<Analytics>("/api/analytics")
      .then(setData)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load."));
  }, []);

  const money = (n: number) => formatMoney(n, data?.currency);
  const maxMonth = Math.max(1, ...(data?.giving.byMonth.map((m) => m.total) ?? [1]));
  const trend = data?.attendance.trend.slice(-16) ?? [];
  const maxHead = Math.max(1, ...trend.map((t) => t.headcount));
  const monthDelta =
    data && data.giving.lastMonth.total > 0
      ? Math.round(
          ((data.giving.thisMonth.total - data.giving.lastMonth.total) / data.giving.lastMonth.total) * 100
        )
      : null;

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1.5 text-slate-500">
          The whole church at a glance{data ? ` — ${data.year}` : ""}.
        </p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {!data && !loadError && (
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Headline numbers */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: Users,
                label: "People",
                value: String(data.people.total),
                sub: `${data.people.byStatus.member ?? 0} members · ${data.people.newLast30} new in 30 days`,
              },
              {
                icon: HandHeart,
                label: "Giving this month",
                value: money(data.giving.thisMonth.total),
                sub:
                  monthDelta === null
                    ? `${data.giving.thisMonth.count} gifts`
                    : `${monthDelta >= 0 ? "+" : ""}${monthDelta}% vs last month`,
              },
              {
                icon: UserCheck,
                label: "Attendance",
                value: data.attendance.last ? String(data.attendance.last.headcount) : "—",
                sub: data.attendance.last
                  ? `${data.attendance.last.serviceName || "Last service"} · ${formatDate(data.attendance.last.date)}${data.attendance.avgHeadcount ? ` · avg ${data.attendance.avgHeadcount}` : ""}`
                  : "Nothing marked in 12 weeks",
              },
              {
                icon: HeartHandshake,
                label: "Visitors to follow up",
                value: String(data.connect.byStatus.new ?? 0),
                sub: `${data.connect.thisMonth} connect cards this month`,
              },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  <Icon className="h-4 w-4 text-indigo-500" aria-hidden />
                  {label}
                </div>
                <p className="mt-2 truncate text-2xl font-bold text-slate-900">{value}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Giving by month */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-slate-900">Giving — {data.year}</h2>
                <span className="text-sm font-bold text-emerald-600">
                  {money(data.giving.thisYear.total)}
                </span>
              </div>
              <div className="mt-4 flex h-32 gap-1.5">
                {data.giving.byMonth.map((m) => (
                  <div key={m.month} className="flex h-full flex-1 flex-col items-center gap-1" title={money(m.total)}>
                    <div className="flex min-h-0 w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-emerald-500 to-teal-400"
                        style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400">{m.month}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1.5">
                {data.giving.byFund.map((f) => (
                  <div key={f.fundName} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{f.fundName}</span>
                    <span className="font-semibold text-slate-800">{money(f.total)}</span>
                  </div>
                ))}
                {data.giving.byFund.length === 0 && (
                  <p className="text-xs text-slate-400">No donations recorded this year.</p>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {data.giving.givers} named giver{data.giving.givers === 1 ? "" : "s"} ·{" "}
                {data.giving.thisYear.count} gifts
              </p>
              <Link
                href="/dashboard/giving"
                className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Open Giving →
              </Link>
            </section>

            {/* Attendance trend */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Attendance — last 12 weeks</h2>
              {trend.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Mark a service in the Attendance app and the trend appears here.
                </p>
              ) : (
                <div className="mt-4 flex h-32 gap-1.5">
                  {trend.map((t) => (
                    <div
                      key={`${t.date}-${t.serviceName}`}
                      className="flex h-full flex-1 flex-col items-center gap-1"
                      title={`${t.serviceName} · ${formatDate(t.date)} · ${t.headcount}`}
                    >
                      <div className="flex min-h-0 w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-orange-400"
                          style={{ height: `${Math.max(2, (t.headcount / maxHead) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">{t.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {data.attendance.checkinsToday} kids checked in today
              </p>
              <Link
                href="/dashboard/attendance"
                className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Open Attendance →
              </Link>
            </section>

            {/* People by status */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">People by status</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {Object.entries(PERSON_STATUS_LABELS).map(([s, label]) => (
                  <div key={s} className="rounded-xl bg-slate-50 px-1 py-3">
                    <p className="text-lg font-bold text-slate-900">{data.people.byStatus[s] ?? 0}</p>
                    <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                {data.people.households} households ·{" "}
                {Object.entries(data.people.genders)
                  .map(([g, n]) => `${g}: ${n}`)
                  .join(" · ") || "no genders recorded"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                <UsersRound className="mr-1 inline h-3.5 w-3.5 text-indigo-500" aria-hidden />
                {data.groups.peopleInGroups} people in {data.groups.active} active group
                {data.groups.active === 1 ? "" : "s"}
              </p>
            </section>

            {/* Connect pipeline */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Visitor follow-up</h2>
              <div className="mt-4 grid grid-cols-5 gap-2 text-center">
                {Object.entries(CONNECT_LABELS).map(([s, label]) => (
                  <div key={s} className="rounded-xl bg-slate-50 px-1 py-3">
                    <p className="text-lg font-bold text-slate-900">{data.connect.byStatus[s] ?? 0}</p>
                    <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/dashboard/connect"
                className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Open Connect →
              </Link>
            </section>

            {/* This week */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Coming up</h2>
              {data.services ? (
                <Link
                  href={`/dashboard/services/plans/${data.services._id}`}
                  className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4 transition-colors hover:bg-indigo-50"
                >
                  <ListMusic className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {data.services.title || "Service"} · {formatDate(data.services.date)}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {data.services.theme || "No theme yet"}
                      {data.services.preacherName ? ` · ${data.services.preacherName}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {data.services.items} items · {data.services.confirmed}/{data.services.volunteers}{" "}
                      volunteers confirmed · {data.services.status}
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No upcoming service plan yet.</p>
              )}
              <ul className="mt-3 space-y-2">
                {data.events.map((e) => (
                  <li key={e._id}>
                    <Link
                      href={`/dashboard/events/${e._id}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-indigo-200"
                    >
                      <CalendarDays className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{e.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(e.startAt)}
                          {e.venue ? ` · ${e.venue}` : ""}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {e.registered}
                        {e.capacity ? `/${e.capacity}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
                {data.events.length === 0 && (
                  <li className="text-sm text-slate-500">No upcoming events.</li>
                )}
              </ul>
            </section>

            {/* Birthdays + activity */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Cake className="h-4 w-4 text-pink-500" aria-hidden />
                Birthdays this week
              </h2>
              {data.people.birthdays.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No birthdays in the next 7 days.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {data.people.birthdays.map((b) => (
                    <li key={b._id}>
                      <Link
                        href={`/dashboard/people/${b._id}`}
                        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pr-3 pl-1 text-xs font-medium text-slate-700 transition-colors hover:border-pink-200 hover:bg-pink-50"
                      >
                        <Avatar name={b.name} photoUrl={b.photoUrl} size="sm" />
                        {b.name}
                        <span className="text-slate-400">{formatDate(b.on)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { icon: Megaphone, label: "Announcements", value: data.activity.announcements },
                  { icon: FileBadge, label: "Certificates", value: data.activity.certificates },
                  { icon: ClipboardCheck, label: "Active staff", value: data.activity.staff },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <Icon className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
                      {label}
                    </div>
                    <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
