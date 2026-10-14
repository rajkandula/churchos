"use client";

import { Copy, Pencil, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { APP_KEYS } from "@/lib/apps";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { AppAccessPreview } from "./AppAccessPreview";
import { RoleDrawer, type RoleDrawerState } from "./RoleDrawer";
import type { RoleDto } from "./types";

export function RolesTab({
  roles,
  onChanged,
}: {
  roles: RoleDto[] | null;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<RoleDrawerState | null>(null);
  const [deleting, setDeleting] = useState<RoleDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function onDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/roles/${deleting._id}`, { method: "DELETE" });
      toast.success(`Deleted the ${deleting.name} role — it's in the Recycle Bin.`);
      setDeleting(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the role.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          A role is a bundle of apps. Give each person one role; change the role and everyone
          in it changes too.
        </p>
        <Button onClick={() => setDrawer({ mode: "new" })}>
          <Plus className="h-4 w-4" aria-hidden />
          New role
        </Button>
      </div>

      {roles === null && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      )}

      {roles?.length === 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50">
              <ShieldCheck className="h-6 w-6 text-indigo-500" aria-hidden />
            </div>
            <p className="mt-3 font-semibold text-slate-900">No roles yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Create a role, pick the apps it can open, then assign it to people on the Users
              tab.
            </p>
          </div>
        </div>
      )}

      {roles && roles.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const deleteBlocked = role.userCount > 0;
            const deleteReason = deleteBlocked
              ? `Move its ${role.userCount} ${role.userCount === 1 ? "user" : "users"} to another role first.`
              : "Delete";
            return (
              <article
                key={role._id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-indigo-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-base font-bold text-slate-900">{role.name}</h3>
                      {role.system && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-500/20">
                          Built-in
                        </span>
                      )}
                      {role.isYours && (
                        <span
                          title="You hold this role — it decides what you can open."
                          className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-600/20"
                        >
                          Your role
                        </span>
                      )}
                      {role.apps.includes("users") && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-600/20">
                          Manages users
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {role.description || "No description."}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[13px] font-semibold text-slate-700">
                    Opens {role.apps.length} of {APP_KEYS.length} apps
                  </p>
                  <AppAccessPreview apps={role.apps} compact limit={5} className="mt-1.5" />
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <UsersRound className="h-3.5 w-3.5" aria-hidden />
                    {role.userCount} {role.userCount === 1 ? "user" : "users"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${role.name}`}
                      title="Edit"
                      onClick={() => setDrawer({ mode: "edit", role })}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${role.name}`}
                      title="Duplicate"
                      onClick={() => setDrawer({ mode: "duplicate", role })}
                      className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {!role.system && (
                      // The title lives on the wrapper: browsers don't surface a
                      // tooltip on a disabled button.
                      <span title={deleteReason} className="inline-flex">
                        <button
                          type="button"
                          aria-label={`Delete ${role.name}`}
                          disabled={deleteBlocked}
                          onClick={() => setDeleting(role)}
                          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                {deleteBlocked && !role.system && (
                  <p className="mt-2 text-right text-[11px] text-slate-400">{deleteReason}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <RoleDrawer state={drawer} onClose={() => setDrawer(null)} onSaved={onChanged} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={deleteBusy}
        title="Delete this role?"
        message={`The ${deleting?.name} role will move to the Recycle Bin. Nobody is using it, so no one loses access.`}
      />
    </>
  );
}
