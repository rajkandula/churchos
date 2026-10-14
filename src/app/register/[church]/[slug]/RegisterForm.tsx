"use client";

import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow duration-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10";

type Result = { status: "registered" | "waitlisted"; name: string; guests: number };

export function RegisterForm({
  church,
  slug,
  eventTitle,
  spotsLeft,
}: {
  church: string;
  slug: string;
  eventTitle: string;
  spotsLeft: number | null;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", guests: "0", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api<{ status: Result["status"]; registration: { name: string; guests: number } }>(
        `/api/public/events/${encodeURIComponent(church)}/${encodeURIComponent(slug)}`,
        { method: "POST", json: form }
      );
      setResult({
        status: data.status,
        name: data.registration.name,
        guests: data.registration.guests,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const waitlisted = result.status === "waitlisted";
    return (
      <div className="animate-scale-in rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-indigo-600/5">
        <span
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            waitlisted ? "bg-amber-50" : "bg-emerald-50"
          }`}
        >
          {waitlisted ? (
            <Clock3 className="h-8 w-8 text-amber-500" aria-hidden />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden />
          )}
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          {waitlisted ? "You're on the waitlist" : "You're registered"}
        </h2>
        <p className="mt-2 text-slate-600">
          {waitlisted
            ? `${eventTitle} is full right now. We've saved ${result.name}'s place on the waitlist and the church will contact you if a spot opens up.`
            : `${result.name}${result.guests > 0 ? ` and ${result.guests} guest${result.guests === 1 ? "" : "s"}` : ""} — see you at ${eventTitle}.`}
        </p>
        <p className="mt-6 text-xs text-slate-400">
          Made a mistake? Contact the church and they can update your registration.
        </p>
      </div>
    );
  }

  const nearlyFull = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-indigo-600/5 sm:p-8"
    >
      <h2 className="text-lg font-bold text-slate-900">Register</h2>
      <p className="mt-1 text-sm text-slate-500">
        {spotsLeft === 0
          ? "This event is full — you can still join the waitlist."
          : nearlyFull
            ? `Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left.`
            : "Takes less than a minute."}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-name" className="text-[13px] font-semibold text-slate-700">
            Full name <span className="text-rose-500">*</span>
          </label>
          <input
            id="reg-name"
            required
            value={form.name}
            onChange={set("name")}
            placeholder="Your name"
            className={inputClass}
            autoComplete="name"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-phone" className="text-[13px] font-semibold text-slate-700">
              Phone
            </label>
            <input
              id="reg-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="Mobile / WhatsApp"
              className={inputClass}
              autoComplete="tel"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reg-email" className="text-[13px] font-semibold text-slate-700">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="name@example.com"
              className={inputClass}
              autoComplete="email"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-400">Give at least one so the church can reach you.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-guests" className="text-[13px] font-semibold text-slate-700">
            Bringing anyone else?
          </label>
          <input
            id="reg-guests"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            value={form.guests}
            onChange={set("guests")}
            className={inputClass}
          />
          <p className="text-xs text-slate-400">Number of extra guests, not counting you.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-notes" className="text-[13px] font-semibold text-slate-700">
            Anything we should know?
          </label>
          <textarea
            id="reg-notes"
            rows={3}
            value={form.notes}
            onChange={set("notes")}
            placeholder="Dietary needs, transport, questions…"
            className={`${inputClass} h-auto min-h-20 resize-y py-2.5`}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {spotsLeft === 0 ? "Join the waitlist" : "Register"}
      </button>
    </form>
  );
}
