"use client";

import { CheckCircle2, CircleAlert, Heart, Send } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { SOURCE_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { AGE_GROUPS, AGE_GROUP_LABELS } from "@/app/dashboard/connect/types";

type Church = { name: string; logoUrl: string };

/** The visitor-facing form — mobile first, one column, big touch targets. */
export function ConnectForm({
  code,
  church,
  interests,
}: {
  code: string;
  church: Church;
  interests: string[];
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    firstTime: true,
    howHeard: "",
    ageGroup: "",
    interests: [] as string[],
    prayerRequest: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set =
    (key: "name" | "phone" | "email" | "howHeard" | "ageGroup" | "prayerRequest") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleInterest = (i: string) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(i)
        ? f.interests.filter((x) => x !== i)
        : [...f.interests, i],
    }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Please tell us your name.");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError("Add a phone number or email so we can say hello.");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/public/connect/${encodeURIComponent(code)}`, {
        method: "POST",
        json: form,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Please try again.");
      setLoading(false);
    }
  }

  const firstName = form.name.trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
        {/* Church header */}
        <div className="animate-fade-up flex flex-col items-center text-center">
          {church.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={church.logoUrl}
              alt=""
              className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-contain p-1.5 shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-md shadow-indigo-600/20">
              {church.name
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <p className="mt-4 text-sm font-semibold tracking-wide text-indigo-600 uppercase">
            {church.name}
          </p>
        </div>

        {sent ? (
          <div className="animate-fade-up mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
              Thank you{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              We&apos;re so glad you joined us. Someone from {church.name} will
              reach out soon{form.phone ? ` on ${form.phone}` : form.email ? ` at ${form.email}` : ""}.
            </p>
            <p className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Heart className="h-3.5 w-3.5 text-rose-400" aria-hidden />
              You&apos;re welcome here any time.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="animate-fade-up mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              We&apos;re glad you came!
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Tell us a little about yourself so we can say hello. It takes less
              than a minute.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <div className="mt-6 space-y-5">
              <TextField
                label="Your name"
                required
                autoComplete="name"
                value={form.name}
                onChange={set("name")}
                placeholder="First and last name"
                maxLength={120}
                className="h-12 text-base"
              />
              <TextField
                label="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="+91 00000 00000"
                className="h-12 text-base"
              />
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                placeholder="name@example.com"
                hint="Phone or email — whichever you prefer we use."
                className="h-12 text-base"
              />

              <fieldset>
                <legend className="text-[13px] font-semibold text-slate-700">
                  Is this your first visit?
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { v: true, label: "Yes, first time" },
                    { v: false, label: "I've been before" },
                  ].map((o) => (
                    <label
                      key={String(o.v)}
                      className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold transition-colors duration-150 ${
                        form.firstTime === o.v
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="firstTime"
                        className="sr-only"
                        checked={form.firstTime === o.v}
                        onChange={() => setForm((f) => ({ ...f, firstTime: o.v }))}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <SelectField
                label="How did you hear about us?"
                value={form.howHeard}
                onChange={set("howHeard")}
                placeholder="Choose one (optional)"
                options={SOURCE_OPTIONS}
                className="h-12 text-base"
              />
              <SelectField
                label="Age group"
                value={form.ageGroup}
                onChange={set("ageGroup")}
                placeholder="Choose one (optional)"
                options={AGE_GROUPS.map((g) => ({ value: g, label: AGE_GROUP_LABELS[g] }))}
                className="h-12 text-base"
              />

              <fieldset>
                <legend className="text-[13px] font-semibold text-slate-700">
                  I&apos;d like to know more about…
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {interests.map((i) => {
                    const on = form.interests.includes(i);
                    return (
                      <label
                        key={i}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
                          on
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleInterest(i)}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                        />
                        {i}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <TextAreaField
                label="Anything we can pray about?"
                value={form.prayerRequest}
                onChange={set("prayerRequest")}
                placeholder="Optional — only our pastoral team will see this."
                maxLength={2000}
                className="text-base"
              />
            </div>

            <Button
              type="submit"
              loading={loading}
              className="mt-7 h-12 w-full text-base"
            >
              <Send className="h-4 w-4" aria-hidden />
              Send my card
            </Button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              We only use this to get in touch with you. No spam, ever.
            </p>
          </form>
        )}
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-slate-400">
        Powered by ChurchOS
      </footer>
    </div>
  );
}
