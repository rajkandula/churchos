"use client";

import { Mail } from "lucide-react";

/**
 * Shows a rendered announcement email exactly as an inbox would.
 *
 * The HTML is user-authored, so it runs inside `sandbox=""` — no scripts, no
 * forms, no navigation, no same-origin access — and inside an iframe so the
 * email's own styles cannot leak into the dashboard (or the dashboard's into
 * the email). Nothing is fetched here: the composer passes `html` in.
 */
export function EmailPreview({ html, loading }: { html: string; loading?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3.5 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </span>
        <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Mail className="h-3.5 w-3.5" />
          Email preview
        </span>
        {loading ? (
          <span className="ml-auto text-xs text-slate-400">Updating…</span>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1">
        {html ? (
          <iframe
            srcDoc={html}
            sandbox=""
            title="Email preview"
            loading="lazy"
            className="h-full min-h-[420px] w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full min-h-[420px] w-full items-center justify-center bg-white px-6 text-center">
            <p className="max-w-xs text-sm text-slate-400">
              Start writing and the email your congregation receives will appear here.
            </p>
          </div>
        )}

        {loading ? (
          <div className="absolute inset-0 bg-white/85 px-8 py-10">
            <div className="mx-auto w-full max-w-[420px] space-y-4">
              <div className="mx-auto h-7 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-px w-full bg-slate-100" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="space-y-2 pt-1">
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-10 w-40 animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
