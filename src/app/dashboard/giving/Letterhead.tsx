"use client";

import type { ChurchInfo } from "./types";

/** Church name, logo and contact block at the top of printed documents. */
export function Letterhead({ church }: { church: ChurchInfo | null }) {
  if (!church) {
    return (
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }
  const contact = [church.phone, church.email].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start gap-4 border-b border-slate-200 pb-6">
      {church.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={church.logoUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white print:bg-slate-900">
          {church.name
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xl font-bold tracking-tight text-slate-900">{church.name}</p>
        {church.address && (
          <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{church.address}</p>
        )}
        {contact && <p className="mt-0.5 text-xs text-slate-500">{contact}</p>}
      </div>
    </div>
  );
}

/** Print-only tweaks: white page, sane margins, no page background. */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 14mm; }
        body { background: #fff !important; }
        main { padding: 0 !important; max-width: none !important; }
      }
    `}</style>
  );
}
