"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { EventDrawer } from "./EventDrawer";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
  dateParts,
  formatEventRange,
  type EventDto,
} from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

function EventCard({ event, currency }: { event: EventDto; currency: string }) {
  const { day, month } = dateParts(event.startAt);
  const cap = event.capacity ?? null;
  const pct = cap ? Math.min(100, Math.round((event.registeredCount / cap) * 100)) : null;
  const full = cap !== null && event.registeredCount >= cap;
  return (
    <Link
      href={`/dashboard/events/${event._id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-600/10"
    >
      <div className="relative h-36 w-full overflow-hidden">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600">
            <CalendarDays className="h-10 w-10 text-white/60" aria-hidden />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md">
          <span className="text-lg leading-none font-bold text-slate-900">{day}</span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-wide text-indigo-600 uppercase">
            {month}
          </span>
        </div>
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${EVENT_STATUS_STYLES[event.status]}`}
        >
          {EVENT_STATUS_LABELS[event.status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-bold text-slate-900 transition-colors duration-150 group-hover:text-indigo-600">
          {event.title}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {formatEventRange(event.startAt, event.endAt)}
        </p>
        {event.venue && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{event.venue}</span>
          </p>
        )}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {event.registeredCount}
              {cap !== null ? ` / ${cap}` : " registered"}
            </span>
            <span className={full ? "font-semibold text-rose-600" : "text-slate-400"}>
              {cap !== null
                ? full
                  ? "Full"
                  : `${event.spotsLeft} left`
                : event.fee > 0
                  ? formatMoney(event.fee, currency)
                  : "Free"}
            </span>
          </div>
          {pct !== null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  full ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventDto[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api<{ church: { currency?: string } }>("/api/settings/church")
      .then((d) => setCurrency(d.church.currency || "INR"))
      .catch(() => {
        /* default currency is fine */
      });
  }, []);

  // Promise-chained (not async/await) so no setState runs synchronously
  // inside the effect that calls it.
  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (statusFilter) params.set("status", statusFilter);
    if (tab === "upcoming") params.set("upcoming", "1");
    if (tab === "past") params.set("past", "1");
    return api<{ events: EventDto[] }>(`/api/events?${params}`)
      .then((data) => {
        setEvents(data.events);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setEvents([]);
        setLoadError(err instanceof Error ? err.message : "Could not load events.");
      });
  }, [debouncedQ, statusFilter, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const upcomingCount = events?.length ?? 0;

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Events</h1>
          <p className="mt-1.5 text-slate-500">
            Camps, conferences, outreaches — with a public link people use to
            register themselves.
            {events && tab === "upcoming"
              ? ` ${upcomingCount} upcoming.`
              : ""}
          </p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          New event
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, venue, organizer or tag…"
            aria-label="Search events"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Cards */}
      {events === null && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="h-36 animate-pulse bg-slate-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {events?.length === 0 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <CalendarDays className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">
              {debouncedQ || statusFilter
                ? "No events match your filters"
                : tab === "upcoming"
                  ? "Nothing coming up"
                  : tab === "past"
                    ? "No past events yet"
                    : "No events yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Create an event, copy its public link and share it on WhatsApp —
              signups land here automatically.
            </p>
            {!debouncedQ && !statusFilter && (
              <Button className="mt-5" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                New event
              </Button>
            )}
          </div>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e._id} event={e} currency={currency} />
          ))}
        </div>
      )}

      <EventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={load}
        currency={currency}
      />
    </div>
  );
}
