"use client";

import {
  Ban,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/client-api";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import {
  audienceLabel,
  describeSendTime,
  relativeToNow,
  STATE_LABELS,
  type AnnouncementDto,
  type HistoryTab,
} from "./types";

const EMPTY: Record<HistoryTab, { title: string; hint: string }> = {
  sent: {
    title: "Nothing sent yet",
    hint: "Write your first announcement on the left — it will show up here with who it reached.",
  },
  scheduled: {
    title: "Nothing scheduled",
    hint: "Choose “Schedule for later” in the composer to line a message up for a date and time.",
  },
  drafts: {
    title: "No drafts",
    hint: "Save a message as a draft to finish it later — the audience can wait.",
  },
};

const chipClass =
  "cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

function StatePill({ state }: { state: AnnouncementDto["state"] }) {
  const tone =
    state === "cancelled"
      ? "bg-slate-100 text-slate-600"
      : state === "failed"
        ? "bg-amber-100 text-amber-800"
        : state === "scheduled"
          ? "bg-sky-50 text-sky-700"
          : state === "draft"
            ? "bg-slate-100 text-slate-600"
            : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>
      {STATE_LABELS[state]}
    </span>
  );
}

export function AnnouncementList({
  tab,
  items,
  loadError,
  busyId,
  editingId,
  onEdit,
  onDelete,
  onSendNow,
  onCancel,
}: {
  tab: HistoryTab;
  /** null = still loading. Already filtered to this tab. */
  items: AnnouncementDto[] | null;
  loadError: string;
  busyId: string | null;
  editingId: string | null;
  onEdit: (a: AnnouncementDto) => void;
  onDelete: (a: AnnouncementDto) => void;
  onSendNow: (a: AnnouncementDto) => void;
  onCancel: (a: AnnouncementDto) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      {loadError && (
        <div
          role="alert"
          className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {items === null && (
        <ul className="divide-y divide-slate-50">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="px-6 py-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
        </ul>
      )}

      {items?.length === 0 && (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
            {tab === "sent" ? (
              <Mail className="h-6 w-6 text-indigo-500" aria-hidden />
            ) : tab === "scheduled" ? (
              <CalendarClock className="h-6 w-6 text-indigo-500" aria-hidden />
            ) : (
              <FileText className="h-6 w-6 text-indigo-500" aria-hidden />
            )}
          </div>
          <p className="mt-3 font-semibold text-slate-900">{EMPTY[tab].title}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{EMPTY[tab].hint}</p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {items.map((a) => {
            const open = expanded === a._id;
            const busy = busyId === a._id;
            const editable = a.state !== "sent";
            const audienceSet =
              a.audienceType === "all" ||
              a.audienceType === "members" ||
              Boolean(a.status || a.tag || a.group);

            return (
              <li
                key={a._id}
                className={`px-6 py-4 ${editingId === a._id ? "bg-indigo-50/40" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : a._id)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                  >
                    <p className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                      {a.title || "Untitled"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {audienceSet ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                          {audienceLabel(a, PERSON_STATUS_LABELS)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                          Audience not set
                        </span>
                      )}
                      {tab !== "sent" && <StatePill state={a.state} />}
                      {tab === "sent" && (
                        <span>
                          Sent to {a.sentTo} · {a.skipped} skipped
                          {a.failed ? ` · ${a.failed} failed` : ""}
                        </span>
                      )}
                    </div>

                    {tab === "scheduled" && a.sendAt && a.state !== "cancelled" && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        Sends {describeSendTime(a.sendAt)}
                        <span className="font-normal text-sky-600">
                          · {relativeToNow(a.sendAt)}
                        </span>
                      </p>
                    )}

                    <p className="mt-1 text-xs text-slate-400">
                      {tab === "sent" ? (
                        <>
                          {a.sentByName ? `${a.sentByName} · ` : ""}
                          {formatDateTime(a.sentAt ?? a.createdAt)}
                        </>
                      ) : (
                        <>Last edited {formatDateTime(a.updatedAt ?? a.createdAt)}</>
                      )}
                    </p>
                  </button>

                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={open ? "Collapse" : "Read announcement"}
                      onClick={() => setExpanded(open ? null : a._id)}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                    >
                      {open ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${a.title}`}
                      onClick={() => onDelete(a)}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {a.lastError && (
                  <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                    <TriangleAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden
                    />
                    <p className="min-w-0 flex-1 text-xs text-amber-800">{a.lastError}</p>
                    {editable && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSendNow(a)}
                        className={`${chipClass} shrink-0 bg-white text-amber-800 hover:bg-amber-100`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Retry
                      </button>
                    )}
                  </div>
                )}

                {editable && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(a)}
                      className={`${chipClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      {a.state === "cancelled" ? "Reschedule" : "Edit"}
                    </button>
                    {a.state !== "cancelled" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSendNow(a)}
                        className={`${chipClass} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden />
                        Send now
                      </button>
                    )}
                    {a.state === "scheduled" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onCancel(a)}
                        className={`${chipClass} bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50`}
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden />
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                {open && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                    {a.body || "Nothing written yet."}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
