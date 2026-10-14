"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  LogOut,
  ChevronDown,
  LayoutGrid,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import type { SessionUser } from "@/lib/auth";
import { canManageUsers, canOpen, type Access } from "@/lib/access-shared";

export function Navbar({
  user,
  access,
  isSuperadmin,
}: {
  user: SessionUser;
  access: Access;
  /** From the database, not the 7-day JWT — a demotion hides the console
   *  on the next page load instead of when the token finally expires. */
  isSuperadmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="transition-opacity duration-200 hover:opacity-80"
        >
          <BrandMark />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl p-1.5 pr-2.5 transition-colors duration-200 hover:bg-slate-100"
          >
            <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
              {initials || "U"}
            </span>
            <span className="hidden text-sm font-semibold text-slate-700 sm:block">
              {user.name}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 animate-scale-in"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {user.email}
                </p>
                {user.churchName && (
                  <p className="mt-1 truncate text-xs font-medium text-indigo-600">
                    {user.churchName}
                    {access.roleName ? ` · ${access.roleName}` : ""}
                  </p>
                )}
              </div>
              <Link
                role="menuitem"
                href="/dashboard?customize=1"
                onClick={() => setOpen(false)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-indigo-600"
              >
                <LayoutGrid className="h-4 w-4" aria-hidden />
                Arrange dashboard
              </Link>
              <Link
                role="menuitem"
                href="/dashboard/profile"
                onClick={() => setOpen(false)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-indigo-600"
              >
                <UserRound className="h-4 w-4" aria-hidden />
                My profile
              </Link>
              {canOpen(access, "settings") && (
                <Link
                  role="menuitem"
                  href="/dashboard/settings"
                  onClick={() => setOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-indigo-600"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  Church settings
                </Link>
              )}
              {canManageUsers(access) && (
                <Link
                  role="menuitem"
                  href="/dashboard/users"
                  onClick={() => setOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-indigo-600"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Users &amp; roles
                </Link>
              )}
              {isSuperadmin && (
                <Link
                  role="menuitem"
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-indigo-600"
                >
                  <Building2 className="h-4 w-4" aria-hidden />
                  Company console
                </Link>
              )}
              <button
                role="menuitem"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
