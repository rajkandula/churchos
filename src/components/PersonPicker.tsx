"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { Avatar } from "@/components/Avatar";

export type PickedPerson = {
  _id: string;
  name: string;
  memberNo: string;
  phone?: string;
  email?: string;
  status?: string;
  photoUrl?: string;
  householdName?: string;
};

/** Debounced search-and-pick combobox over the People register. */
export function PersonPicker({
  value,
  onChange,
  placeholder = "Search by name, member no, phone or email…",
  status,
}: {
  value: PickedPerson | null;
  onChange: (person: PickedPerson | null) => void;
  placeholder?: string;
  /** Restrict results to one status, e.g. "member". */
  status?: string;
}) {
  const [q, setQ] = useState("");
  const [fetched, setFetched] = useState<PickedPerson[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // An empty query shows nothing — derived, so clearing needs no state write
  const results = q.trim() ? fetched : [];

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, limit: "8" });
      if (status) params.set("status", status);
      api<{ people: PickedPerson[] }>(`/api/people?${params}`)
        .then((data) => {
          setFetched(data.people);
          setOpen(true);
        })
        .catch(() => setFetched([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
        <Avatar name={value.name} photoUrl={value.photoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{value.name}</p>
          <p className="truncate text-xs text-slate-500">
            {value.memberNo}
            {value.phone ? ` · ${value.phone}` : ""}
            {value.householdName ? ` · ${value.householdName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
          }}
          aria-label="Clear selected person"
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-white hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <Search
        className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        aria-label="Search people"
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          {results.map((p) => (
            <li key={p._id}>
              <button
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-indigo-50/60"
              >
                <Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {p.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {p.memberNo}
                    {p.phone ? ` · ${p.phone}` : ""}
                    {p.householdName ? ` · ${p.householdName}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-xl">
          No one matches “{q}”.
        </div>
      )}
    </div>
  );
}
