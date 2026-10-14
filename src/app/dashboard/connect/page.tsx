"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Inbox,
  Phone,
  Plus,
  QrCode,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { CardDrawer } from "./CardDrawer";
import { NewCardDrawer } from "./NewCardDrawer";
import { ShareLinkModal } from "./ShareLinkModal";
import {
  COLUMN_ACCENT,
  CONNECT_STATUSES,
  CONNECT_STATUS_LABELS,
  STATUS_STYLES,
  daysSince,
  initials,
  type Assignee,
  type ConnectCardDto,
  type ConnectStatus,
} from "./types";

const selectClass =
  "h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

type ChurchInfo = { name: string; code: string };

export default function ConnectPage() {
  const toast = useToast();
  const [cards, setCards] = useState<ConnectCardDto[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Fetch runs in the effect; state is only set inside the promise callbacks.
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (onlyUnassigned) params.set("assigned", "unassigned");
    else if (assigneeFilter) params.set("assigned", assigneeFilter);
    api<{ cards: ConnectCardDto[]; counts: Record<string, number> }>(
      `/api/connect?${params}`
    )
      .then((data) => {
        if (!alive) return;
        setLoadError("");
        setCards(data.cards);
        setCounts(data.counts);
      })
      .catch((err) => {
        if (!alive) return;
        setCards([]);
        setLoadError(err instanceof Error ? err.message : "Could not load connect cards.");
      });
    return () => {
      alive = false;
    };
  }, [debouncedQ, assigneeFilter, onlyUnassigned, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    api<{ assignees: Assignee[] }>("/api/connect/assignees")
      .then((d) => setAssignees(d.assignees))
      .catch(() => {});
    api<{ church: ChurchInfo }>("/api/settings/church")
      .then((d) => setChurch(d.church))
      .catch(() => {});
  }, []);

  const publicUrl = useMemo(() => {
    if (!church?.code || typeof window === "undefined") return "";
    return `${window.location.origin}/connect/${church.code}`;
  }, [church?.code]);

  async function copyLink() {
    if (!publicUrl) {
      toast.error("The church code isn't ready yet — try again in a moment.");
      return;
    }
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Connect card link copied.");
    } catch {
      toast.error("Could not copy — select the link in the QR dialog instead.");
      setQrOpen(true);
    }
  }

  /** Optimistic status change from a board card. */
  async function changeStatus(card: ConnectCardDto, status: ConnectStatus) {
    const prev = cards;
    const prevCounts = counts;
    setCards((cur) => cur?.map((c) => (c._id === card._id ? { ...c, status } : c)) ?? null);
    setCounts((cur) => ({
      ...cur,
      [card.status]: Math.max(0, (cur[card.status] ?? 0) - 1),
      [status]: (cur[status] ?? 0) + 1,
    }));
    try {
      const { card: next } = await api<{ card: ConnectCardDto }>(`/api/connect/${card._id}`, {
        method: "PATCH",
        json: { status },
      });
      setCards((cur) => cur?.map((c) => (c._id === next._id ? next : c)) ?? null);
    } catch (err) {
      setCards(prev ?? null);
      setCounts(prevCounts);
      toast.error(err instanceof Error ? err.message : "Could not move the card.");
    }
  }

  // Updaters must stay pure (React may run them twice in dev), so the
  // count adjustments are derived from the current closure, not inside them.
  function onCardChanged(next: ConnectCardDto) {
    const before = cards?.find((c) => c._id === next._id);
    if (before && before.status !== next.status) {
      setCounts((k) => ({
        ...k,
        [before.status]: Math.max(0, (k[before.status] ?? 0) - 1),
        [next.status]: (k[next.status] ?? 0) + 1,
      }));
    }
    setCards((cur) => cur?.map((c) => (c._id === next._id ? next : c)) ?? null);
  }

  function onCardDeleted(id: string) {
    const gone = cards?.find((c) => c._id === id);
    if (gone) {
      setCounts((k) => ({
        ...k,
        [gone.status]: Math.max(0, (k[gone.status] ?? 0) - 1),
      }));
    }
    setCards((cur) => cur?.filter((c) => c._id !== id) ?? null);
    setSelectedId(null);
  }

  const selected = cards?.find((c) => c._id === selectedId) ?? null;
  const byStatus = useMemo(() => {
    const map: Record<ConnectStatus, ConnectCardDto[]> = {
      new: [],
      contacted: [],
      "visited-again": [],
      joined: [],
      closed: [],
    };
    for (const c of cards ?? []) map[c.status]?.push(c);
    return map;
  }, [cards]);

  const total = cards?.length ?? 0;
  const newCount = counts.new ?? 0;
  const filtered = Boolean(debouncedQ || assigneeFilter || onlyUnassigned);

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Connect</h1>
          <p className="mt-1.5 text-slate-500">
            First-time visitor cards and follow-up —{" "}
            {cards === null ? "…" : `${total} card${total === 1 ? "" : "s"}`}
            {cards !== null && newCount > 0 && (
              <>
                , <span className="font-semibold text-amber-700">{newCount} new</span> waiting
                for a hello
              </>
            )}
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={copyLink}>
            <Copy className="h-4 w-4" aria-hidden />
            Copy connect card link
          </Button>
          <Button variant="secondary" onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4" aria-hidden />
            Show QR
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Add card manually
          </Button>
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

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email or city…"
            aria-label="Search connect cards"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
          className={selectClass}
          disabled={onlyUnassigned || !assignees.length}
        >
          <option value="">All assignees</option>
          {assignees.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 select-none">
          <input
            type="checkbox"
            checked={onlyUnassigned}
            onChange={(e) => setOnlyUnassigned(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-indigo-600"
          />
          Only unassigned
        </label>
      </div>

      {/* Board */}
      <div className="mt-5 flex gap-4 overflow-x-auto pb-4 xl:grid xl:grid-cols-5 xl:overflow-visible">
        {CONNECT_STATUSES.map((status) => {
          const list = byStatus[status];
          return (
            <section
              key={status}
              aria-label={`${CONNECT_STATUS_LABELS[status]} column`}
              className={`flex w-[280px] shrink-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-slate-50/70 shadow-sm xl:w-auto ${COLUMN_ACCENT[status]}`}
            >
              <header className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <h2 className="text-sm font-bold text-slate-800">
                  {CONNECT_STATUS_LABELS[status]}
                </h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  {cards === null ? "…" : (counts[status] ?? list.length)}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2.5 px-3 pb-3">
                {cards === null &&
                  [0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-xl border border-slate-100 bg-white"
                    />
                  ))}

                {cards !== null && list.length === 0 && (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center">
                    <Inbox className="h-5 w-5 text-slate-300" aria-hidden />
                    <p className="mt-2 text-xs text-slate-400">
                      {status === "new" && !filtered
                        ? "No new cards — share the QR code at the door."
                        : "Nothing here"}
                    </p>
                  </div>
                )}

                {list.map((c) => {
                  const days = daysSince(c.visitDate);
                  const stale = status === "new" && days >= 7;
                  return (
                    <div
                      key={c._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(c._id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(c._id);
                        }
                      }}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(c.visitDate)}
                            <span
                              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                stale
                                  ? "bg-rose-50 text-rose-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {days === 0 ? "today" : `${days}d ago`}
                            </span>
                          </p>
                        </div>
                        {c.assignedTo ? (
                          <span
                            title={`Assigned to ${c.assignedToName}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-[10px] font-bold text-indigo-600"
                          >
                            {initials(c.assignedToName || "?")}
                          </span>
                        ) : (
                          <span
                            title="Unassigned"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] font-bold text-slate-300"
                          >
                            ?
                          </span>
                        )}
                      </div>

                      {c.phone && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400" aria-hidden />
                          {c.phone}
                        </p>
                      )}

                      {(c.interests.length > 0 || c.firstTime) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.firstTime && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Sparkles className="h-2.5 w-2.5" aria-hidden />
                              First time
                            </span>
                          )}
                          {c.interests.slice(0, 2).map((i) => (
                            <span
                              key={i}
                              className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700"
                            >
                              {i}
                            </span>
                          ))}
                          {c.interests.length > 2 && (
                            <span className="text-[10px] font-semibold text-slate-400">
                              +{c.interests.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      <select
                        value={c.status}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          changeStatus(c, e.target.value as ConnectStatus);
                        }}
                        aria-label={`Status of ${c.name}`}
                        className={`mt-3 h-7 w-full cursor-pointer rounded-lg border px-2 text-[11px] font-semibold outline-none transition-colors duration-200 focus:ring-2 focus:ring-indigo-500/30 ${STATUS_STYLES[c.status]}`}
                      >
                        {CONNECT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {CONNECT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <CardDrawer
        key={selectedId ?? "none"}
        card={selected}
        onClose={() => setSelectedId(null)}
        onChanged={onCardChanged}
        onDeleted={onCardDeleted}
        assignees={assignees}
      />

      <NewCardDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={reload}
        assignees={assignees}
      />

      <ShareLinkModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={publicUrl}
        churchName={church?.name ?? "Our church"}
        onCopy={copyLink}
      />
    </div>
  );
}
