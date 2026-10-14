"use client";

import Link from "next/link";
import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        json: { identifier },
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send the reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <MailCheck className="h-7 w-7 text-emerald-600" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Check your email
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          If an account exists for{" "}
          <span className="font-semibold text-slate-700">{identifier}</span>,
          we&apos;ve emailed a password reset link. It&apos;s valid for 1 hour.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Forgot your password?
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Enter your username or email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
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
          label="Username or email"
          required
          autoComplete="username"
          placeholder="e.g. priya.sharma or you@yourchurch.org"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />

        <Button type="submit" loading={loading} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
