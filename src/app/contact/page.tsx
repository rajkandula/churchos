"use client";

import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { TextField, TextAreaField } from "@/components/ui/Field";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    churchName: "",
    email: "",
    phone: "",
    message: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/public/contact", { method: "POST", json: form });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fb]">
      <PublicNav />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        {sent ? (
          <div className="animate-fade-up text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
              Message sent
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              Thanks, {form.name.split(" ")[0]} — we&apos;ll get back to you
              shortly at {form.email || form.phone}.
            </p>
          </div>
        ) : (
          <div className="animate-fade-up">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Talk to us
            </h1>
            <p className="mt-2 text-slate-500">
              Want ChurchOS for your church? Tell us a little about it and
              we&apos;ll reach out.
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              noValidate
            >
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700 animate-fade-in"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}
              <TextField
                label="Your name"
                required
                value={form.name}
                onChange={set("name")}
              />
              <TextField
                label="Church name"
                value={form.churchName}
                onChange={set("churchName")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                />
                <TextField
                  label="Phone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
              <TextAreaField
                label="Message"
                required
                rows={4}
                value={form.message}
                onChange={set("message")}
                placeholder="Tell us about your church — size, campuses, what you need…"
              />
              <Button type="submit" loading={loading} className="w-full">
                <Send className="h-4 w-4" aria-hidden />
                Send message
              </Button>
            </form>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
