"use client";

import { FilePlus2, LayoutTemplate, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import type { Template, TemplatesResponse } from "./types";

/** First line of a template body — enough to recognise it at a glance. */
function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim());
  return line ? line.trim() : "";
}

function TemplateCard({
  template,
  onPick,
  children,
}: {
  template: Template;
  onPick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white transition-colors duration-150 hover:border-indigo-300">
      <button
        type="button"
        onClick={onPick}
        className="w-full cursor-pointer px-4 py-3 text-left"
      >
        <p className="text-sm font-semibold text-slate-900">{template.name}</p>
        {template.description && (
          <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
        )}
        <p className="mt-1.5 truncate text-xs text-slate-400 italic">
          {firstLine(template.body) || "Empty message"}
        </p>
      </button>
      {children}
    </div>
  );
}

export function TemplatePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  /** null means "Blank" — clear the composer. */
  onPick: (template: Template | null) => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Promise-chain loader: every setState lands in a .then/.catch callback.
  const load = useCallback(() => {
    api<TemplatesResponse>("/api/announcements/templates")
      .then((d) => {
        setData({ builtIn: d.builtIn ?? [], saved: d.saved ?? [] });
        setConfirmingId(null);
        setError("");
      })
      .catch((err) => {
        setData({ builtIn: [], saved: [] });
        setConfirmingId(null);
        setError(err instanceof Error ? err.message : "Could not load templates.");
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  function onDelete(t: Template) {
    if (!t._id) return;
    setDeletingId(t._id);
    api(`/api/announcements/templates/${t._id}`, { method: "DELETE" })
      .then(() => {
        toast.success(`Deleted the "${t.name}" template.`);
        setConfirmingId(null);
        setDeletingId(null);
        load();
      })
      .catch((err) => {
        setDeletingId(null);
        toast.error(err instanceof Error ? err.message : "Could not delete the template.");
      });
  }

  const categories = Array.from(
    new Set((data?.builtIn ?? []).map((t) => t.category || "General"))
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Start from a template"
      subtitle="Pick a starting point, then make it yours."
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => onPick(null)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-left transition-colors duration-150 hover:border-indigo-300 hover:bg-indigo-50/40"
      >
        <FilePlus2 className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-slate-900">Blank</p>
          <p className="text-xs text-slate-500">Clear the composer and write from scratch.</p>
        </div>
      </button>

      {data === null && (
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {categories.map((category) => (
        <section key={category} className="mt-6">
          <h3 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
            {category}
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {(data?.builtIn ?? [])
              .filter((t) => (t.category || "General") === category)
              .map((t) => (
                <TemplateCard
                  key={t.key ?? t.name}
                  template={t}
                  onPick={() => onPick(t)}
                />
              ))}
          </div>
        </section>
      ))}

      <section className="mt-6">
        <h3 className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
          Your templates
        </h3>
        {data && data.saved.length === 0 ? (
          <div className="mt-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <LayoutTemplate className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <p className="text-xs text-slate-500">
              None yet. Write a message, then use <b>Save as template</b> to keep it here for
              next time.
            </p>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {(data?.saved ?? []).map((t) => (
              <TemplateCard key={t._id} template={t} onPick={() => onPick(t)}>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2">
                  {confirmingId === t._id ? (
                    <>
                      <span className="mr-auto text-xs text-slate-500">Delete this template?</span>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === t._id}
                        onClick={() => onDelete(t)}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition-colors duration-150 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === t._id ? "Deleting…" : "Delete"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete the ${t.name} template`}
                      onClick={() => setConfirmingId(t._id ?? null)}
                      className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </TemplateCard>
            ))}
          </div>
        )}
      </section>
    </Drawer>
  );
}
