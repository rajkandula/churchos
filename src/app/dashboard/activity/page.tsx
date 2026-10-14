"use client";

import Link from "next/link";
import { ArrowLeft, History, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDateTime } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { ITEM_TYPE_APPS } from "@/lib/audit-labels";

const ACTION_STYLES: Record<string, { label: string; cls: string; Icon: typeof Plus }> = {
  create: { label: "Created", cls: "bg-emerald-50 text-emerald-700", Icon: Plus },
  update: { label: "Edited", cls: "bg-indigo-50 text-indigo-700", Icon: Pencil },
  delete: { label: "Deleted", cls: "bg-rose-50 text-rose-600", Icon: Trash2 },
  restore: { label: "Restored", cls: "bg-amber-50 text-amber-700", Icon: RotateCcw },
};

const TYPE_LABELS = ITEM_TYPE_APPS;

type Entry = {
  _id: string;
  action: keyof typeof ACTION_STYLES;
  itemType: string;
  label: string;
  userName: string;
  createdAt: string;
};

export default function ActivityPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(
    () =>
      api<{ entries: Entry[] }>("/api/activity")
        .then((d) => setEntries(d.entries))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Could not load.");
          setEntries([]);
        }),
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const apps = useMemo(
    () =>
      Array.from(
        new Set((entries ?? []).map((e) => TYPE_LABELS[e.itemType] ?? e.itemType))
      ).sort(),
    [entries]
  );
  const visible = (entries ?? []).filter(
    (e) => !filter || (TYPE_LABELS[e.itemType] ?? e.itemType) === filter
  );

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Activity
          </h1>
          <p className="mt-1.5 text-slate-500">
            Every change across your apps — who did what, and when.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by app"
          className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"
        >
          <option value="">All apps</option>
          {apps.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {entries === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <History className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm text-slate-500">
              No activity yet — changes made in any app will show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {visible.map((e) => {
              const style = ACTION_STYLES[e.action] ?? ACTION_STYLES.update;
              return (
                <li
                  key={e._id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${style.cls}`}
                  >
                    <style.Icon className="h-3 w-3" aria-hidden />
                    {style.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {e.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {TYPE_LABELS[e.itemType] ?? e.itemType}
                  </span>
                  <span className="text-xs text-slate-400">
                    {e.userName || "—"} · {formatDateTime(e.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
