"use client";

import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { APP_ICONS } from "@/lib/app-icons";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  arrangeApps,
  type DashboardPrefs,
  type Density,
  type LauncherApp,
} from "./dashboard-prefs";

type Section = "visible" | "hidden";

/** One app in the list: drag handle, icon, name, move buttons, show/hide. */
function AppRow({
  app,
  index,
  count,
  section,
  onMove,
  onToggle,
  onDragStart,
  onDrop,
}: {
  app: LauncherApp;
  index: number;
  count: number;
  section: Section;
  onMove: (section: Section, index: number, delta: number) => void;
  onToggle: (key: string) => void;
  onDragStart: (section: Section, key: string) => void;
  onDrop: (section: Section, index: number) => void;
}) {
  const Icon = APP_ICONS[app.key];
  const isHidden = section === "hidden";

  return (
    <li
      draggable
      onDragStart={() => onDragStart(section, app.key)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(section, index);
      }}
      className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm transition-colors duration-200 hover:border-slate-300 ${
        isHidden ? "opacity-75" : ""
      }`}
    >
      <span
        aria-hidden
        className="cursor-grab text-slate-300 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${app.accent} text-white shadow-sm`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
        {app.name}
      </span>

      <span className="flex items-center">
        <button
          type="button"
          onClick={() => onMove(section, index, -1)}
          disabled={index === 0}
          aria-label={`Move ${app.name} up`}
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(section, index, 1)}
          disabled={index === count - 1}
          aria-label={`Move ${app.name} down`}
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </span>

      <button
        type="button"
        onClick={() => onToggle(app.key)}
        aria-label={
          isHidden
            ? `Show ${app.name} on your dashboard`
            : `Hide ${app.name} from your dashboard`
        }
        className={`ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors duration-200 ${
          isHidden
            ? "text-indigo-600 hover:bg-indigo-50"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }`}
      >
        {isHidden ? (
          <Eye className="h-4 w-4" aria-hidden />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden />
        )}
        {isHidden ? "Show" : "Hide"}
      </button>
    </li>
  );
}

function DensityCard({
  value,
  current,
  title,
  hint,
  onPick,
  children,
}: {
  value: Density;
  current: Density;
  title: string;
  hint: string;
  onPick: (value: Density) => void;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <label
      className={`flex cursor-pointer flex-col rounded-2xl border-2 p-4 transition-colors duration-200 ${
        active
          ? "border-indigo-500 bg-indigo-50/40"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <input
        type="radio"
        name="dashboard-density"
        className="sr-only"
        aria-label={`${title} layout — ${hint.toLowerCase()}`}
        checked={active}
        onChange={() => onPick(value)}
      />
      <span className="text-sm font-bold text-slate-900">{title}</span>
      <span className="mt-0.5 text-xs text-slate-500">{hint}</span>
      <span className="mt-3 block rounded-xl bg-slate-50 p-2.5">{children}</span>
    </label>
  );
}

/**
 * The personal arrangement panel. Everything it changes is private to the
 * signed-in user — it never touches roles, access or anyone else's view.
 */
export function CustomizeAppsDrawer({
  open,
  onClose,
  onSaved,
  apps,
  prefs,
}: {
  open: boolean;
  onClose: () => void;
  /** Saved or reset — the launcher should close and re-read from the server. */
  onSaved: () => void;
  apps: LauncherApp[];
  prefs: DashboardPrefs;
}) {
  const toast = useToast();
  // Seeded once, when the drawer mounts: the parent renders it only while
  // it is open, so there is never a stale draft to sync from props.
  const [keys, setKeys] = useState<Record<Section, string[]>>(() => {
    const { visible, hiddenApps } = arrangeApps(apps, prefs);
    return {
      visible: visible.map((a) => a.key),
      hidden: hiddenApps.map((a) => a.key),
    };
  });
  const [density, setDensity] = useState<Density>(prefs.density);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const dragged = useRef<{ section: Section; key: string } | null>(null);

  const byKey = new Map(apps.map((a) => [a.key as string, a]));
  const rows = (section: Section) =>
    keys[section]
      .map((key) => byKey.get(key))
      .filter((a): a is LauncherApp => Boolean(a));

  function move(section: Section, index: number, delta: number) {
    setKeys((prev) => {
      const list = [...prev[section]];
      const next = index + delta;
      if (next < 0 || next >= list.length) return prev;
      [list[index], list[next]] = [list[next], list[index]];
      return { ...prev, [section]: list };
    });
  }

  function toggle(key: string) {
    setKeys((prev) =>
      prev.hidden.includes(key)
        ? {
            visible: [...prev.visible, key],
            hidden: prev.hidden.filter((k) => k !== key),
          }
        : {
            visible: prev.visible.filter((k) => k !== key),
            hidden: [...prev.hidden, key],
          }
    );
  }

  function onDragStart(section: Section, key: string) {
    dragged.current = { section, key };
  }

  function onDrop(section: Section, index: number) {
    const from = dragged.current;
    dragged.current = null;
    if (!from || from.section !== section) return;
    setKeys((prev) => {
      const list = [...prev[section]];
      const at = list.indexOf(from.key);
      if (at < 0 || at === index) return prev;
      list.splice(at, 1);
      list.splice(index, 0, from.key);
      return { ...prev, [section]: list };
    });
  }

  function save() {
    setSaving(true);
    api<{ prefs: DashboardPrefs }>("/api/dashboard-prefs", {
      method: "PUT",
      json: {
        order: [...keys.visible, ...keys.hidden],
        hidden: keys.hidden,
        density,
      },
    })
      .then(() => {
        toast.success("Your dashboard is arranged.");
        onSaved();
      })
      .catch((err) => {
        setSaving(false);
        toast.error(
          err instanceof Error ? err.message : "Could not save your dashboard."
        );
      });
  }

  function reset() {
    setResetting(true);
    api<{ prefs: DashboardPrefs }>("/api/dashboard-prefs", { method: "DELETE" })
      .then(() => {
        setConfirmReset(false);
        toast.success("Dashboard back to the default layout.");
        onSaved();
      })
      .catch((err) => {
        setResetting(false);
        toast.error(
          err instanceof Error ? err.message : "Could not reset your dashboard."
        );
      });
  }

  const visibleRows = rows("visible");
  const hiddenRows = rows("hidden");

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Arrange your dashboard"
        subtitle="Only you see this — it doesn't change what anyone else sees, or what you have access to."
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setConfirmReset(true)}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset to default
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        <section>
          <h3 className="text-sm font-bold text-slate-900">Layout</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <DensityCard
              value="comfortable"
              current={density}
              onPick={setDensity}
              title="Comfortable"
              hint="Name and description"
            >
              <span className="flex gap-2">
                <span className="h-8 w-8 shrink-0 rounded-lg bg-slate-300" />
                <span className="flex-1 space-y-1.5 pt-1">
                  <span className="block h-2 w-2/3 rounded bg-slate-300" />
                  <span className="block h-2 w-full rounded bg-slate-200" />
                </span>
              </span>
            </DensityCard>
            <DensityCard
              value="compact"
              current={density}
              onPick={setDensity}
              title="Compact"
              hint="Icon tiles only"
            >
              <span className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <span key={i} className="flex flex-col items-center gap-1">
                    <span className="h-5 w-5 rounded-md bg-slate-300" />
                    <span className="h-1 w-4 rounded bg-slate-200" />
                  </span>
                ))}
              </span>
            </DensityCard>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Apps</h3>
            <p className="text-xs font-medium text-slate-500">
              {visibleRows.length} of {apps.length} apps shown
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Drag a row, or use the arrows, to change the order.
          </p>

          {visibleRows.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Every app is hidden. Show one below to bring your dashboard back.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visibleRows.map((app, i) => (
                <AppRow
                  key={app.key}
                  app={app}
                  index={i}
                  count={visibleRows.length}
                  section="visible"
                  onMove={move}
                  onToggle={toggle}
                  onDragStart={onDragStart}
                  onDrop={onDrop}
                />
              ))}
            </ul>
          )}

          {hiddenRows.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-bold text-slate-900">
                Hidden from your dashboard
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Hidden apps still work — reach them by link, or show them again
                here.
              </p>
              <ul className="mt-3 space-y-2">
                {hiddenRows.map((app, i) => (
                  <AppRow
                    key={app.key}
                    app={app}
                    index={i}
                    count={hiddenRows.length}
                    section="hidden"
                    onMove={move}
                    onToggle={toggle}
                    onDragStart={onDragStart}
                    onDrop={onDrop}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </Drawer>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={reset}
        loading={resetting}
        title="Reset your dashboard?"
        message="Your dashboard goes back to every app you can open, in the default order and the roomy layout. Nobody else is affected."
        confirmLabel="Reset"
      />
    </>
  );
}
