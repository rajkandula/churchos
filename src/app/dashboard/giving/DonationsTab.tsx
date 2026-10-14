"use client";

import Link from "next/link";
import { Download, HandCoins, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client-api";
import { PAYMENT_MODES } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/Avatar";
import type { PickedPerson } from "@/components/PersonPicker";
import { DonationModal } from "./DonationModal";
import {
  MODE_STYLES,
  iconButtonClass,
  selectClass,
  yearOptions,
  type DonationDto,
  type FundDto,
} from "./types";

const LIMIT = 500;

export function DonationsTab({
  currency,
  funds,
  personFilter,
  personName,
  onChanged,
}: {
  currency: string;
  funds: FundDto[];
  personFilter: string;
  personName: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [donations, setDonations] = useState<DonationDto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loadError, setLoadError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [fundFilter, setFundFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DonationDto | null>(null);
  const [deleting, setDeleting] = useState<DonationDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (fundFilter) params.set("fund", fundFilter);
    if (modeFilter) params.set("mode", modeFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (yearFilter) params.set("year", yearFilter);
    if (personFilter) params.set("person", personFilter);
    return params;
  }, [debouncedQ, fundFilter, modeFilter, from, to, yearFilter, personFilter]);

  // Promise chain (not async/await) so every setState runs in a callback,
  // never synchronously inside the effect that triggers the load.
  const load = useCallback(() => {
    const params = buildParams();
    params.set("limit", String(LIMIT));
    return api<{ donations: DonationDto[]; total: number; count: number }>(
      `/api/giving/donations?${params}`
    )
      .then((data) => {
        setDonations(data.donations);
        setTotal(data.total);
        setCount(data.count);
        setLoadError("");
      })
      .catch((err: unknown) => {
        setDonations([]);
        setLoadError(err instanceof Error ? err.message : "Could not load donations.");
      });
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    load();
    onChanged();
  }, [load, onChanged]);

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/giving/donations/${deleting._id}`, { method: "DELETE" });
      toast.success(`Receipt ${deleting.receiptNo} deleted — it's in the Recycle Bin.`);
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function exportCsv() {
    window.open(`/api/giving/donations/export?${buildParams()}`, "_blank");
  }

  const hasFilters = Boolean(
    debouncedQ || fundFilter || modeFilter || from || to || yearFilter || personFilter
  );
  const defaultPerson: PickedPerson | null =
    personFilter && personName ? { _id: personFilter, name: personName, memberNo: "" } : null;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search giver, receipt no or reference…"
            aria-label="Search donations"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <select
          value={fundFilter}
          onChange={(e) => setFundFilter(e.target.value)}
          aria-label="Filter by fund"
          className={selectClass}
        >
          <option value="">All funds</option>
          {funds.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          aria-label="Filter by payment mode"
          className={selectClass}
        >
          <option value="">All modes</option>
          {PAYMENT_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
            className={selectClass}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
            className={selectClass}
          />
        </div>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          aria-label="Filter by year"
          className={selectClass}
        >
          <option value="">All years</option>
          {yearOptions(6).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2.5">
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Record donation
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3.5">Receipt</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Giver</th>
                <th className="px-4 py-3.5">Fund</th>
                <th className="px-4 py-3.5">Mode</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations === null &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}

              {donations?.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center px-6 py-16 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
                        <HandCoins className="h-6 w-6 text-indigo-500" aria-hidden />
                      </div>
                      <p className="mt-3 font-semibold text-slate-900">
                        {hasFilters ? "No donations match your filters" : "No donations yet"}
                      </p>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Record tithes, offerings and designated gifts here — each one gets a
                        printable receipt.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {donations?.map((d) => (
                <tr
                  key={d._id}
                  className="border-b border-slate-50 transition-colors duration-150 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dashboard/giving/receipts/${d._id}/print`}
                      className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      {d.receiptNo}
                    </Link>
                    {d.reference && (
                      <p className="mt-0.5 max-w-[10rem] truncate text-[11px] text-slate-400">
                        {d.reference}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{formatDate(d.date)}</td>
                  <td className="px-4 py-3.5">
                    {d.person ? (
                      <Link
                        href={`/dashboard/people/${d.person}`}
                        className="flex items-center gap-2.5"
                      >
                        <Avatar name={d.personName} size="sm" />
                        <span className="font-semibold text-slate-900 transition-colors duration-150 hover:text-indigo-600">
                          {d.personName}
                        </span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <HandCoins className="h-4 w-4 text-slate-400" aria-hidden />
                        </span>
                        <span className="font-medium text-slate-500">Anonymous</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{d.fundName}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        MODE_STYLES[d.mode] ?? "bg-slate-100 text-slate-600 ring-slate-500/20"
                      }`}
                    >
                      {d.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                    {formatMoney(d.amount, currency)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/dashboard/giving/receipts/${d._id}/print`}
                        aria-label={`Print receipt ${d.receiptNo}`}
                        className={iconButtonClass}
                      >
                        <Printer className="h-4 w-4" />
                      </Link>
                      <button
                        aria-label={`Edit receipt ${d.receiptNo}`}
                        onClick={() => {
                          setEditing(d);
                          setModalOpen(true);
                        }}
                        className={iconButtonClass}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Delete receipt ${d.receiptNo}`}
                        onClick={() => setDeleting(d)}
                        className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {donations && donations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
            <span>
              Showing {donations.length} of {count} donation{count === 1 ? "" : "s"}
              {donations.length < count ? ` (first ${LIMIT})` : ""}
            </span>
            <span className="text-sm font-bold text-slate-900">
              Total {formatMoney(total, currency)}
            </span>
          </div>
        )}
      </div>

      <DonationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        funds={funds}
        existing={editing}
        defaultPerson={defaultPerson}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this donation?"
        message={`Receipt ${deleting?.receiptNo} for ${formatMoney(
          deleting?.amount ?? 0,
          currency
        )} from ${deleting?.personName} will move to the Recycle Bin. The receipt number will not be reused.`}
      />
    </>
  );
}
