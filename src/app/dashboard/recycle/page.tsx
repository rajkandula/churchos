"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ITEM_TYPE_LABELS } from "@/lib/audit-labels";

const TYPE_LABELS = ITEM_TYPE_LABELS;

type RecycleDto = {
  _id: string;
  itemType: string;
  label: string;
  deletedBy?: { name?: string };
  deletedAt: string;
};

export default function RecyclePage() {
  const toast = useToast();
  const [items, setItems] = useState<RecycleDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purging, setPurging] = useState<RecycleDto | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ items: RecycleDto[] }>("/api/recycle")
        .then((d) => setItems(d.items))
        .catch(() => setItems([])),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  async function restore(item: RecycleDto) {
    setBusyId(item._id);
    try {
      await api("/api/recycle", {
        method: "POST",
        json: { id: item._id, action: "restore" },
      });
      toast.success(`Restored — ${item.label} is back in its app.`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore.");
    } finally {
      setBusyId(null);
    }
  }

  async function purge() {
    if (!purging) return;
    setPurgeBusy(true);
    try {
      await api("/api/recycle", {
        method: "POST",
        json: { id: purging._id, action: "purge" },
      });
      toast.success("Deleted forever.");
      setPurging(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setPurgeBusy(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
        Recycle Bin
      </h1>
      <p className="mt-1.5 text-slate-500">
        Everything deleted across your apps lands here — restore it with one
        click, or delete it forever.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Trash2 className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm text-slate-500">
              Nothing here — deleted records from any app will appear in this
              bin, ready to restore.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((item) => (
              <li
                key={item._id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {TYPE_LABELS[item.itemType] ?? item.itemType}
                    </span>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Deleted {item.deletedBy?.name ? `by ${item.deletedBy.name} ` : ""}
                    · {formatDateTime(item.deletedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="secondary"
                    loading={busyId === item._id}
                    onClick={() => restore(item)}
                    className="h-9 px-3 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPurging(item)}
                    className="h-9 px-3 text-xs text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete forever
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(purging)}
        onClose={() => setPurging(null)}
        onConfirm={purge}
        loading={purgeBusy}
        title="Delete forever?"
        message={`${purging?.label} will be permanently removed and can never be restored.`}
      />
    </div>
  );
}
