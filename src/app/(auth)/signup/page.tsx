"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordInput } from "@/components/PasswordInput";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    churchName: "",
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { status } = await api<{ status: string }>("/api/auth/signup", {
        method: "POST",
        json: form,
      });
      router.push(status === "approved" ? "/dashboard" : "/pending");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Set up the admin account for your church.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
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
          label="Church name"
          required
          autoComplete="organization"
          placeholder="e.g. Sunrise Public Church"
          value={form.churchName}
          onChange={set("churchName")}
        />
        <TextField
          label="Full name"
          required
          autoComplete="name"
          placeholder="e.g. Priya Sharma"
          value={form.name}
          onChange={set("name")}
        />
        <TextField
          label="Username"
          required
          autoComplete="username"
          placeholder="e.g. priya.sharma"
          hint="Lowercase letters, numbers, dots and underscores."
          value={form.username}
          onChange={set("username")}
        />
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourchurch.org"
          value={form.email}
          onChange={set("email")}
        />
        <PasswordInput
          label="Password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={set("password")}
        />
        <PasswordInput
          label="Confirm password"
          required
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
        />

        <Button type="submit" loading={loading} className="mt-2 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
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
