"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Tabs } from "@/components/ui/Tabs";
import { UsersTab } from "./UsersTab";
import { RolesTab } from "./RolesTab";
import type { RoleDto, UserDto } from "./types";

const TABS = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
];

export default function UsersPage() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [roles, setRoles] = useState<RoleDto[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadUsers = useCallback(
    () =>
      api<{ users: UserDto[] }>("/api/users")
        .then((d) => {
          setUsers(d.users);
          setLoadError("");
        })
        .catch((err) => {
          setUsers([]);
          setLoadError(err instanceof Error ? err.message : "Could not load users.");
        }),
    []
  );

  const loadRoles = useCallback(
    () =>
      api<{ roles: RoleDto[] }>("/api/roles")
        .then((d) => setRoles(d.roles))
        .catch((err) => {
          setRoles([]);
          setLoadError(err instanceof Error ? err.message : "Could not load roles.");
        }),
    []
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Role user-counts and user role-names both change on either edit. Returns a
  // promise so a row can keep its control busy until the fresh list lands.
  const refresh = useCallback(
    () => Promise.all([loadUsers(), loadRoles()]).then(() => undefined),
    [loadUsers, loadRoles]
  );

  const active = users?.filter((u) => u.status === "approved").length ?? 0;
  const disabled = users?.filter((u) => u.status === "disabled").length ?? 0;

  return (
    <div className="animate-fade-up">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Users &amp; roles</h1>
          <p className="mt-1.5 text-slate-500">
            Who can sign in, and which apps each role can open —{" "}
            {users ? `${active} active user${active === 1 ? "" : "s"}` : "… users"}
            {disabled > 0 ? `, ${disabled} disabled` : ""}, {roles ? roles.length : "…"} role
            {roles?.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {loadError}
        </div>
      )}

      {tab === "users" ? (
        <UsersTab users={users} roles={roles ?? []} onChanged={refresh} />
      ) : (
        <RolesTab roles={roles} onChanged={refresh} />
      )}
    </div>
  );
}
